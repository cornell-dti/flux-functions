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

require("dotenv").config({ path: "../.env" });
const https = require("https");
const Datastore = require("@google-cloud/datastore");

const datastore = Datastore();
const Util = require("../src/util");

const EATERYNAME_MAP = {
  "Cook-House-Dining": "cook",
  "Cafe-Jennie": "cafejennie",
  "Becker-House-Dining": "becker",
  "Jansens-Dining": "bethe",
  "Keeton-House-Dining": "keeton",
  "104-West": "west104",
  "North-Star": "appel",
  Okenshields: "okies",
  "Amit-Bhatia-Libe-Cafe": "libe",
  "RPCC-Marketplace": "rpcc",
  "Risley-Dining": "risley",
  "Rose-House-Dining": "rose",
};

function processDiningHalls(objArray) {
  return objArray.map((day) => ({
    date: day.date,
    menus: day.events.map((event) => ({
      startTime: event.startTimestamp,
      endTime: event.endTimestamp,
      description: event.descr,
      menu: event.menu.map((m) => ({
        category: m.category,
        items: m.items.map((innerItem) => innerItem.item),
      })),
    })),
  }));
}

function processCafes(objArray) {
  return objArray.map((diningItem) => diningItem.item);
}

function insertData(data) {
  console.log(data);
  const eateries = (data.data || {}).eateries || {};
  return Promise.all(
    eateries.map(
      (eatery) =>
        new Promise((resolve, reject) => {
          // TODO: Change it so its 'safer'. Right now, I'm assuming that the
          // first entry in eatery types is a Cafe because that's what it seems
          // to be by inspection.
          const isDiningHall = !!eatery.eateryTypes[0].descr === "Cafe";
          const weeksMenus = isDiningHall
            ? processDiningHalls(eatery.operatingHours)
            : processCafes(eatery.diningItems);
          const location = {
            address: eatery.location,
            area: eatery.campusArea.descrshort,
            coordinates: eatery.coordinates,
          };

          console.log(weeksMenus);
          const key = datastore.key(["dining", `${eatery.slug}`]);
          if (EATERYNAME_MAP[eatery.slug] !== null) {
            datastore.upsert(
              {
                key,
                data: {
                  id: EATERYNAME_MAP[eatery.slug] || "unknown",
                  type: isDiningHall ? "dining-hall" : "cafe",
                  weeksMenus,
                  location,
                },
              },
              (err) => {
                if (err) {
                  reject(err);
                  console.log(err);
                }
                resolve();
              }
            );
          }
        })
    )
  );
}

function diningData(fnData) {
  const { API_ENDPOINT, API_PATH, API_AUTHORIZATION, API_KEY } = process.env;

  const data = {
    hostname: API_ENDPOINT,
    path: API_PATH,
    headers: {
      Authorization: API_AUTHORIZATION,
      "x-api-key": API_KEY,
    },
  };

  return Util.getJSON(data, https)
    .then((json) => insertData(json))
    .then(() => "Success")
    .catch((err) => console.log(err));
}

exports.handler = diningData;
