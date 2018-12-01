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
const Util = require('../util');

const moment = require('moment');

// TODO Don't hardcode
const EATERYNAME_MAP = {
    'Cook-House-Dining': 'cook',
    'Cafe-Jennie': 'cafejennie',
    'Becker-House-Dining': 'becker',
    'Jansens-Dining': 'bethe',
    'Keeton-House-Dining': 'keeton',
    '104-West': 'west104',
    'North-Star': 'appel',
    'Okenshields': 'okies',
    'Amit-Bhatia-Libe-Cafe': 'libe',
    'RPCC-Marketplace': 'rpcc',
    'Risley-Dining': 'risley',
    'Rose-House-Dining': 'rose'
}

function insertData(data) {
    const eateries = (data['data'] || {})['eateries'] || {};
    let times = {};

    const currentDate = moment().format('YYYY-MM-DD');
    let places = {};

    return Promise.all(eateries.map(eatery => new Promise((resolve, reject) => {
        const strippedSlug = Util.strip(eatery.slug);

        if (!times[strippedSlug]) {
            times[strippedSlug] = [];
        }
        const place = eatery['campusArea']['descrshort'].toLowerCase();

        places[strippedSlug] = place;

        const today = eatery['operatingHours'].find(e => e.date == currentDate);

        if (today) {
            let evs = today['events'];

            if (evs)
                for (const ev of Array.from(evs)) {
                    times[strippedSlug].push({
                        startTimestamp: ev.startTimestamp,
                        endTimestamp: ev.endTimestamp
                    })
                }
        }


        const key = datastore.key(['hours', `${eatery.slug}`]);

        datastore.upsert({
            key: key,
            data: {
                id: EATERYNAME_MAP[eatery.slug] || 'unknown',
                campusLocation: places[strippedSlug],
                nextOpen: -1,
                nextClosing: -1,
                operatingHours: times[strippedSlug]
            }
        },
            err => {
                if (err) reject(err);
                resolve();
            }
        );
    })));
}

exports.handler = function updateHours(fnData) {
    const API_ENDPOINT = process.env.API_ENDPOINT;
    const API_PATH = process.env.API_PATH;

    const data = {
        hostname: API_ENDPOINT,
        path: API_PATH
    };

    return Util.getJSON(data, https).then(json => insertData(json)).then(() => {
        return 'Success';
    });
};