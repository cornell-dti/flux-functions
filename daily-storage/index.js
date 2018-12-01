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
const PubSub = require('@google-cloud/pubsub');
const Util = require('../util');
const datastore = Datastore();
const pubsub = new PubSub();

const moment = require('moment');

const TOPIC = 'DATA_COUNTS_UPDATED';

function insertData(data) {
  const dateString = data.TIMESTAMP;
  const units = data.UNITS;
  console.log('Updating date for date time of ' + dateString.toString());
  // TODO Utilize timezoning/correct API source instead of raw offsets.
  // WARNING Will break on daylight savings changes!
  const dateObject = moment(`${dateString} -05:00`, 'YYYY-MM-DD hh:mm:ss A ZZ').utc();
  console.log('Timezone adjusted date: ' + dateString.toString());
  const timestamp = dateObject.valueOf();

  return new Promise((resolve, reject) => {
    const counts = {};

    units.forEach(unit => {
      counts[Util.strip(unit.UNIT_NAME)] = unit.CROWD_COUNT;
    });

    counts.timestamp = timestamp;

    const key = datastore.key(['counts', `${timestamp}`]);

    datastore.upsert({
      key: key,
      data: {
        key: key,
        ...counts
      }
    },
      err => {
        if (err) reject(err);
        resolve();
      }
    );
  });
}

exports.handler = function updateDensityData(fnData) {
  // defining the api-endpoint
  const API_ENDPOINT = process.env.API_ENDPOINT;
  const API_PATH = process.env.API_PATH;

  // your API key here
  const API_KEY = process.env.API_KEY;
  const API_AUTHORIZATION = process.env.API_AUTHORIZATION;

  // data to be sent to api
  const data = {
    hostname: API_ENDPOINT,
    path: API_PATH,
    headers: {
      Authorization: API_AUTHORIZATION,
      'x-api-key': API_KEY
    }
  };

  return Util.getJSON(data, https).then(json => insertData(json)).then(() => {
    const dataBuffer = Buffer.from('Data was updated.');

    return pubsub
      .topic(TOPIC)
      .publisher()
      .publish(dataBuffer);
  }).then(messageId => {
    console.log('messageId: ' + messageId);
    return 'Message received: ' + messageId;
  });
};