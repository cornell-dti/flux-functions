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

const https = require('https');
const Datastore = require('@google-cloud/datastore');

const datastore = Datastore();
const moment = require('moment-timezone');
const Util = require('../src/util');

// TODO Don't hardcode
const EATERYNAME_MAP = {
  'Cook-House-Dining': 'cook',
  'Cafe-Jennie': 'cafejennie',
  'Becker-House-Dining': 'becker',
  'Jansens-Dining': 'bethe',
  'Keeton-House-Dining': 'keeton',
  '104-West': 'west104',
  'North-Star': 'appel',
  Okenshields: 'okies',
  'Amit-Bhatia-Libe-Cafe': 'libe',
  'RPCC-Marketplace': 'rpcc',
  'Risley-Dining': 'risley',
  'Rose-House-Dining': 'rose'
};

function insertData(data) {
  const eateries = (data.data || {}).eateries || {};
  let weekMoment = []; 
  let day = moment()
    .tz('America/New_York'); 
  // we want to store from day before until 6 days in the future 
  // guarantee we can get data within one week range 
  // moment('1998-12-22', 'YYYY-MM-DD').tz('America/New_York').unix()
  day = day.clone().subtract(1, 'd'); 
  for (let i = 0; i <= 7; i++) {
    weekMoment.push(day); 
    day = day.clone().add(1, 'd');
  }
  let week = []
  for (let i = 0; i <= 7; i++) {
    week.push([weekMoment[i], weekMoment[i].format('YYYY-MM-DD')]);
  }
  console.log("Weeks: ")
  console.log(week);
  console.log(); 
  return Promise.all(
    eateries.map(
      eatery => new Promise((resolve, reject) => {
        const times = [];
      
        const place = eatery.campusArea.descrshort.toLowerCase();
        const description = eatery.aboutshort || eatery.about;
        for (const [moment, currentDate] of week) {
          const today = eatery.operatingHours.find(e => e.date === currentDate);
          if (today) {
            const evs = today.events;

            if (evs) {
              for (const ev of Array.from(evs)) {
                times.push({
                  date: currentDate, 
                  dayOfWeek: moment.day(), 
                  status: "open", 
                  statusText: "open",
                  dailyHours: {
                  startTimestamp: ev.startTimestamp,
                  endTimestamp: ev.endTimestamp
                }});
              }
            }
          }
        }
        const key = datastore.key(['development-testing-hours', `${eatery.slug}`]);
        if (EATERYNAME_MAP[eatery.slug] != null) {
          console.log({data: 
            {
              id: EATERYNAME_MAP[eatery.slug] || 'unknown',
              hours: times
            }
          })
          datastore.upsert(
            {
              key,
              data: {
                id: EATERYNAME_MAP[eatery.slug] || 'unknown',
                hours: times
              }
            },
            err => {
              if (err) reject(err);
              resolve();
            }
          );
        }
      })
    )
  );
}

exports.handler = function updateHours(fnData) {
  const { API_ENDPOINT, API_PATH } = process.env;

  const data = {
    hostname: API_ENDPOINT,
    path: API_PATH
  };

  return Util.getJSON(data, https)
    .then(json => insertData(json))
    .then(() => 'Success');
};
