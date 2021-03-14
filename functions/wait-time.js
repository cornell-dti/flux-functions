/**
 *  Campus Density Backend
 *  Copyright (C) 2018 Cornell Design & Tech Initiative
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, version 3 of the License only.
 *
 *   This program is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *   GNU Affero General Public License for more details.
 *
 *   You should have received a copy of the GNU Affero General Public License
 *   along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * Command to deploy this function
 * gcloud functions deploy waitTime --trigger-topic="WAIT_TIME_UPDATE" --env-vars-file .env.yaml
 */

/**
 * 0. Initialize global line length counter [This will be reset between meals, or when dining hall closes]
 * 1. Want to fetch arrival data ~ swipe-in data in the last 5 minutes
 * 2. Fetch the service rate for the dining hall at given time
 *      Def service rate := # people who CAN get served every 5 minutes
 *      2.1 Find serving time for one person, 5 / serving time for one person (= waittimes/serviceRates/serviceRate_HC) = service rate
 * 3. waitline length = max(line length + newest arrival rate - service rate, 0). (Execute very 5 minutes) [update length]
 * 4. Waittime = waitline length * time for one person
 */
const https = require('https');
const fetch = require('node-fetch');
const admin = require('firebase-admin');
const Util = require('../src/util');

const serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const slugs = [
  "Kosher",
  "Carl Becker House",
  "Alice Cook House",
  "Keeton House",
  "North Star Marketplace",
  "Okenshields",
  "Jansens at Bethe House",
  "Risley",
  "RPME",
  "Rose Dining Hall",
  "Olin Libe Cafe",
  "Cafe Jennie",
];

const days = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
];

// function to calculate how much to weight user feedback based on the number
// of user feedbacks given, according to a ln curve maxing out at 30%
// Right now, the function is quite simple - weight(x) = 0.15ln(x). The
// parameters can be tweaked later, and a sigmoid curve could also be used.
function calculateWeight(numFeedback) {
  const maxWeight = 0.3;
  const weight = numFeedback ? 0.15 * Math.log(numFeedback) : 0;
  return Math.min(maxWeight, weight);
}

async function getFeedback(diningHall, day, prediction) {
  const hour = new Date().getHours().toString();
  const feedbackData = await db
    .collection('feedbackData')
    .doc(diningHall)
    .collection(day)
    .doc(hour)
    .get();
  if (feedbackData.exists) {
    return {
      feedback: feedbackData.data().observedWait,
      weight: calculateWeight(feedbackData.data().count)
    };
  }
  return { feedback: 0, weight: 0 };
}

async function getCurrentMeal(slug) {
  // fetch all dining data
  let menuData = {};
  await fetch('https://now.dining.cornell.edu/api/1.0/dining/eateries.json')
    .then(res => res.json())
    .then(menus => {
      menuData = menus;
    });

  const eateryData = menuData.data.eateries.find(
    eatery => eatery.slug === slug
  );
  if (!eateryData) throw new Error('Could not find data for the given eatery');

  // fetch today's data
  const currTime = new Date();
  const formattedDate = `${currTime.getFullYear()}-${currTime.getMonth() + 1
  }-${currTime.getDate()}`;
  const { operatingHours } = eateryData;
  const todaysData = operatingHours.find(obj => obj.date === formattedDate);

  if (!todaysData) throw new Error('Could not fetch today\'s data');

  // Convert timestamp to seconds
  const timestamp = currTime.getTime() / 1000;

  // find current meal
  const currMealObject = todaysData.events.find(
    mealObject => timestamp >= mealObject.startTimestamp
      && timestamp < mealObject.endTimestamp
  );

  if (!currMealObject) throw new Error('Dining hall closed');
  return currMealObject.descr;
}

// diningHall is the slug in the earteries json. Rename vars later?
// numLines represents the number of queues in the dining hall
async function computeNewWaitline(diningHall, day, numLines) {
  // Fetch the current line length
  // const currMeal = getCurrentMeal(diningHall);

  const lineLength = (await db.collection('waittimes').doc('lineLengths').get()).data()[
    diningHall
  ] || 0;
  // console.log("The current line length of " + diningHall + " is " + lineLength);

  // Fetch swipe data fro the last 5 minutes
  const {
    API_ENDPOINT, API_PATH, API_AUTHORIZATION, API_KEY
  } = process.env;

  const data = {
    hostname: API_ENDPOINT,
    path: API_PATH,
    headers: {
      Authorization: API_AUTHORIZATION,
      'x-api-key': API_KEY
    }
  };

  const swipeData = await Util.getJSON(data, https);
  console.log(swipeData);
  // servingTimeForOnePerson is a placeholder value.

  const servingTimeForOnePerson = ((await db.collection('waittimes').doc('serviceRates').get()).data().serviceRate_HC
    || 75 / 60) / numLines; // We got this data from cornell dining

  // Compute the service rate, which we define as the number of people who can
  // be served in 5 minutes
  const serviceRate = 5 / servingTimeForOnePerson;
  // console.log(`Serving time for one person: ${servingTimeForOnePerson}`);
  // console.log(`Service rate: ${serviceRate}`);

  const swipeDataForEatery = (swipeData.UNITS.find(element => element.UNIT_NAME === diningHall) || {})
    .CROWD_COUNT || 0;

  // console.log(`swipeDataForEatery: ${swipeDataForEatery}`);
  const newWaitlineLength = Math.max(
    lineLength + swipeDataForEatery - serviceRate,
    0
  );
  const ewt = servingTimeForOnePerson * newWaitlineLength;
  // console.log("The new waitline: " + newWaitlineLength);
  // console.log("The estimated wait time is: " + ewt);

  // factoring in user feedback for that day/hour
  const feedbackData = await getFeedback(diningHall, day, ewt);

  const weightedWait = feedbackData.weight * feedbackData.feedback
    + (1 - feedbackData.weight) * ewt;

  // update the estimated waittime field on firebase
  await db
    .collection('waittimes')
    .doc('waittimes')
    .update({ [diningHall]: weightedWait, timestamp: Date.now() });

  // update the waitline length field
  await db
    .collection('waittimes')
    .doc('lineLengths')
    .update({ [diningHall]: newWaitlineLength, timestamp: Date.now() });

  // Log Data for R&D
  await db
    .collection('waitTimesHistoryLogs')
    .doc(diningHall)
    .collection('data')
    .doc(new Date().toString())
    .set({
      serviceRate,
      swipeDataForEatery,
      lineLength
    });
}

async function waitTime(fnData) {
  const day = days[new Date().getDay()];
  const numLines = (await db.collection('waittimes').doc('numLines').get()).data();
  return Promise.all(slugs.map(slug => computeNewWaitline(slug, day, numLines.slug || 1)));
}

// computeNewWaitline("RPME", "monday");
exports.handler = waitTime;
