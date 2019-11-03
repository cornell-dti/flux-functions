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
const Util = require('../src/util');

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
  return Promise.all(
    eateries.map(
      eatery => new Promise((resolve, reject) => {
        const weeksMenus = [];
        for (const openDay of eatery.operatingHours) {
          const dayMenus = [];
          for (const openTime of openDay.events) {
            const menuData = openTime.menu;
            const menu = [];
            for (const menuSection of menuData) {
              menu.push({
                category: menuSection.category,
                items: menuSection.items.map(items => items.item)
              });
            }
            if (menu.length !== 0) {
              dayMenus.push({
                description: openTime.descr,
                startTime: openTime.startTimestamp,
                endTime: openTime.endTimestamp,
                menu
              });
            }
          }
          if (dayMenus.length !== 0) {
            weeksMenus.push({
              date: openDay.date,
              menus: dayMenus
            });
          }
        }
        const key = datastore.key(['dining', `${eatery.slug}`]);
        if (EATERYNAME_MAP[eatery.slug] !== null) {
          datastore.upsert(
            {
              key,
              data: {
                id: EATERYNAME_MAP[eatery.slug] || 'unknown',
                weeksMenus
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

exports.handler = function diningData(fnData) {
  const { API_ENDPOINT, API_PATH } = process.env;

  const data = {
    hostname: API_ENDPOINT,
    path: API_PATH
  };

  return Util.getJSON(data, https)
    .then(json => insertData(json))
    .then(() => 'Success');
};
