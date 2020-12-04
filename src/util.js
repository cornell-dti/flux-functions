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

exports.strip = function strip(str) {
  return str.replace(/\W/g, '');
};

let httpsLib = null;

function getHTTPSLib() {
  if (httpsLib == null) {
    // eslint-disable-next-line global-require
    httpsLib = require('https');
  }

  return httpsLib;
}

exports.getJSON = function getJSON(data, https = getHTTPSLib()) {
  return new Promise((resolve, reject) => {
    const request = https.get(data, result => {
      let body = '';

      result.on('data', chunk => {
        body += chunk;
      });

      result.on('end', () => {
        const jsdata = JSON.parse(body);
        resolve(jsdata);
      });
    });
    request.on('error', e => {
      reject(e);
    });
  });
};
