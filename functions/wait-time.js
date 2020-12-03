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

/* eslint-disable camelcase */

/**
 * 0. Initialize global line length counter [This will be reset between meals, or when dining hall closes]
 * 1. Want to fetch arrival data ~ swipe-in data in the last 5 minutes
 * 2. Fetch the service rate for the dining hall at given time
 *      Def service rate := # people who CAN get served every 5 minutes
 *      2.1 Find serving time for one person, 5 / serving time for one person = service rate
 * 3. waitline length = max(line length + newest arrival rate - service rate, 0). (Execute very 5 minutes) [update length]
 * 4. Waittime = waitline length * time for one person
 */
const Firestore = require("@google-cloud/firestore");
require("dotenv").config({ path: "../.env" });
const Util = require("../src/util");
const https = require("https");
const fetch = require("node-fetch");
const admin = require("firebase-admin");

const serviceAccount = {
  type: "service_account",
  project_id: "campus-density",
  private_key_id: process.env.PRIVATE_KEY_ID,
  private_key: process.env.PRIVATE_KEY,
  client_email:
    "firebase-adminsdk-inv51@campus-density.iam.gserviceaccount.com",
  client_id: "115352834756945054444",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url:
    "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-inv51%40campus-density.iam.gserviceaccount.com",
};
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

const slugs = [
  "104-West",
  "Becker-House-Dining",
  "Cook-House-Dining",
  "Keeton-House-Dining",
  "North-Star",
  "Okenshields",
  "Jansens-Dining",
  "Risley-Dining",
  "RPCC-Marketplace",
  "Rose-House-Dining",
];

const days = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

async function getCurrentMeal(slug) {
  // fetch all dining data
  let menuData = {};
  await fetch("https://now.dining.cornell.edu/api/1.0/dining/eateries.json")
    .then((res) => res.json())
    .then((menus) => (menuData = menus));

  const eateryData = menuData.data.eateries.find(
    (eatery) => eatery.slug === slug
  );
  if (!eateryData) throw new Error("Could not find data for the given eatery");

  // fetch today's data
  const currTime = new Date();
  const formattedDate = `${currTime.getFullYear()}-${
    currTime.getMonth() + 1
  }-${currTime.getDate()}`;
  const operatingHours = eateryData.operatingHours;
  const todaysData = operatingHours.find((obj) => obj.date === formattedDate);

  if (!todaysData) throw new Error("Could not fetch today's data");

  // COnvert timestamp to seconds
  const timestamp = currTime.getTime() / 1000;

  // find current meal
  const currMealObject = todaysData.events.find((mealObject) => {
    return (
      timestamp >= mealObject.startTimestamp &&
      timestamp < mealObject.endTimestamp
    );
  });

  if (!currMealObject) throw new Error("Dining hall closed");
  return currMealObject.descr;
}

// diningHall is the slug in the earteries json. Rename vars later?
async function computeNewWaitline(diningHall, day) {
  // Fetch the current line length
  // const currMeal = getCurrentMeal(diningHall);

  const lineLength = (
    await db.collection("waittimes").doc("lineLengths").get()
  ).data()[diningHall];
  // console.log("The current line length of " + diningHall + " is " + lineLength);

  // Fetch swipe data fro the last 5 minutes
  const { API_ENDPOINT, API_PATH, API_AUTHORIZATION, API_KEY } = process.env;

  const data = {
    hostname: API_ENDPOINT,
    path: API_PATH,
    headers: {
      Authorization: API_AUTHORIZATION,
      "x-api-key": API_KEY,
    },
  };

  const swipeData = await Util.getJSON(data, https);
  // console.log(swipeData);

  // servingTimeForOnePerson is a placeholder value.
  // Compute the service rate, which we define as the number of people who can
  // be served in 5 minutes
  const servingTimeForOnePerson =
    (await db.collection("waittimes").doc("serviceRates").get()).data()[
      "serviceRate_HC"
    ] || 75 / 60; // We got this data from cornell dining
  const serviceRate = 5 / servingTimeForOnePerson;
  // console.log(`Serving time for one person: ${servingTimeForOnePerson}`);
  // console.log(`Service rate: ${serviceRate}`);

  const swipeDataForEatery =
    (swipeData.UNITS.find((element) => element.UNIT_NAME === diningHall) || {})
      .CROWD_COUNT || 0;

  // console.log(`swipeDataForEatery: ${swipeDataForEatery}`);
  const newWaitlineLength = Math.max(
    lineLength + swipeDataForEatery - serviceRate,
    0
  );
  const ewt = servingTimeForOnePerson * newWaitlineLength;
  // console.log("The new waitline: " + newWaitlineLength);
  // console.log("The estimated wait time is: " + ewt);

  // update the estimated waittime field on firebase
  await db
    .collection("waittimes")
    .doc("waittimes")
    .update({ [diningHall]: ewt, timestamp: Date.now() });

  // update the waitline length field
  await db
    .collection("waittimes")
    .doc("lineLengths")
    .update({ [diningHall]: newWaitlineLength, timestamp: Date.now() });
}

function estimateWaittime(fnData) {
  const day = days[new Date().getDay()];
  return Promise.all(slugs.map((slug) => computeNewWaitline(slug, day)));
}

// computeNewWaitline("Becker-House-Dining", "monday");
exports.handler = estimateWaittime;
