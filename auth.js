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

const Datastore = require('@google-cloud/datastore');

const datastore = Datastore();
const uuidv4 = require('uuid/v4');
const moment = require('moment');

// TODO Validate iOS vendor ids
const UUID_VALIDATE_IOS = /[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}/;

const Util = require('./util');

exports.handler = function authv1(req, res) {
  if (!req.headers['x-api-key'] || !req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) {
    console.log(`Malformed header for authv1: ${req.headers['x-api-key']}`);
    res.status(403).send('Unauthorized');
    return;
  }

  if (req.method !== 'PUT') {
    res.status(400).send('Only serves over PUT');
    return;
  }

  const idToken = req.headers.authorization.split('Bearer ')[1];
  const vendorId = req.headers['x-api-key'];
  const apiKey = process.env.AUTH_KEY;
  const uuid = uuidv4();
  const token = Buffer.from(uuid).toString('base64');

  const { receipt } = req.body;

  let isIOS; // receipt && receipt !== ''

  if (UUID_VALIDATE_IOS.test(vendorId)) {
    isIOS = true;
  } else {
    isIOS = false;
  }

  const densityKey = datastore.key({
    namespace: 'auth',
    path: ['auth_info', Util.strip(vendorId)]
  });

  if (idToken === apiKey) {
    datastore.upsert(
      {
        key: densityKey,
        data: {
          instanceId: vendorId,
          ios: isIOS,
          uuid,
          token,
          generated: moment().valueOf()
        }
      },
      err => {
        if (err) {
          res.status(500).send(err);
        } else {
          res.status(201).send({
            token
          });
        }
      }
    );
  } else {
    res.status(401).send('Unable to authenticate api key.');
  }
};
