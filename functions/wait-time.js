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
const { service } = require("firebase-functions/lib/providers/analytics");
const PROJECTID = "campus-density";
const db = new Firestore({
  projectId: PROJECTID,
  timestampsInSnapshots: true,
});

async function computeNewWaitline(diningHall, day, currMeal) {
  // Fetch the current line length
  const lineLength = (
    await db.collection("waittimes").doc("lineLengths").get()
  ).data()[diningHall];
  console.log("The current line length of " + diningHall + " is " + lineLength);

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
  console.log(swipeData);

  // servingTimeForOnePerson is a placeholder value.
  // Compute the service rate, which we define as the number of people who can
  // be served in 5 minutes
  const servingTimeForOnePerson = (
    await db
      .collection("waittimes")
      .doc("serviceRates")
      .collection(diningHall)
      .doc(day)
      .get()
  ).data()[currMeal];
  const serviceRate = 5 / servingTimeForOnePerson;
  console.log(`Serving time for one person: ${servingTimeForOnePerson}`);
  console.log(`Service rate: ${serviceRate}`);

  const swipeDataForEatery = (
    swipeData.UNITS.find((element) => element.UNIT_NAME === diningHall) || {}
  ).CROWD_COUNT;

  if (!swipeDataForEatery)
    throw new Error("Could not fetch swipe data for this dining hall");

  console.log(`swipeDataForEatery: ${swipeDataForEatery}`);
  const newWaitlineLength = Math.max(
    lineLength + swipeDataForEatery - serviceRate,
    0
  );
  const ewt = servingTimeForOnePerson * newWaitlineLength;
  console.log("The new waitline: " + newWaitlineLength);
  console.log("The estimated wait time is: " + ewt);
}

computeNewWaitline("RPME", "monday", "lunch");
