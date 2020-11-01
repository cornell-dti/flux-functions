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

const moment = require("moment");
const Datastore = require("@google-cloud/datastore");

const Util = require("../src/util");

const datastore = Datastore();

function analysisLog(strippedUnitName, logMessage) {
  console.log(`[${strippedUnitName}] ${logMessage}`);
}

function analyseData() {
  console.log("Starting analysis of latest density data.");

  const current = moment();
  current.minutes(5 * Math.floor(current.minutes() / 5));
  current.seconds(0);
  current.milliseconds(0);
  current.subtract(2, "hours");

  const comparison = moment();
  const mom = moment();
  mom.minutes(5 * Math.floor(mom.minutes() / 5));
  mom.seconds(0);
  mom.milliseconds(0);

  const countsQuery = datastore
    .createQuery("counts")
    .filter("timestamp", ">=", current.valueOf());

  return new Promise((resolve, reject) => {
    console.log("Retrieving facility metadata.");
    const query = datastore.createQuery("facility_metadata", "facility_info");
    datastore.runQuery(query, (err, entities) => {
      console.log(
        `Found metadata for the following facilities: ${JSON.stringify(
          entities.map((entity) => entity.display_name)
        )}`
      );
      if (err) {
        reject(err);
      } else {
        resolve(
          entities.map((entity) => {
            const {
              avg_stay_length_minutes,
              display_name,
              peak_flow,
              stickiness,
              unit_name,
            } = entity;

            console.log(
              `Metadata for ${display_name} found: ${JSON.stringify({
                avg_stay_length_minutes,
                display_name,
                peak_flow,
                stickiness,
                unit_name,
              })}`
            );

            return {
              avg_stay_length_minutes,
              display_name,
              peak_flow,
              stickiness,
              unit_name,
            };
          })
        );
      }
    });
  }).then((entities) =>
    new Promise((resolve, reject) => {
      datastore.runQuery(countsQuery, (err, counts) => {
        if (err) {
          reject(err);
        } else {
          const mapping = {};
          counts.forEach((count) => {
            mapping[`${count.timestamp}`] = count;
          });
          resolve([entities, mapping]);
        }
      });
    }).then(([entities, counts]) =>
      Promise.all(
        entities.map(
          (entity) =>
            new Promise((res, rej) => {
              const strippedUnitName = Util.strip(entity.unit_name);

              analysisLog(
                strippedUnitName,
                `Analysing: ${entity.display_name}`
              );

              const densityKey = datastore.key({
                namespace: "density",
                path: ["density_info", strippedUnitName],
              });
              analysisLog(
                strippedUnitName,
                `Retrieving density data for: ${entity.display_name}`
              );
              datastore.get(densityKey, (error, densityResult) => {
                if (error) {
                  rej(error);
                  return;
                }

                analysisLog(
                  strippedUnitName,
                  `Density data found for: ${entity.display_name}`
                );
                analysisLog(
                  strippedUnitName,
                  `Previous Analysis Data: ${JSON.stringify(densityResult)}`
                );

                let populi = 0;

                let density = 0;

                let lastRun = -1;

                if (densityResult) {
                  if (typeof densityResult.populi === "number") {
                    populi = densityResult.populi;
                  } else {
                    populi = 0;
                  }

                  if (densityResult.lastRun) {
                    lastRun = moment(densityResult.lastRun).valueOf();
                  }
                }

                let previousEntrants = 0;

                let entrants = 0;

                const result = (counts[`${mom.valueOf()}`] || {})[
                  strippedUnitName
                ];

                if (counts) {
                  if (lastRun && lastRun !== -1) {
                    if (lastRun === mom.valueOf()) {
                      analysisLog(
                        strippedUnitName,
                        `${entity.display_name} has already been updated.`
                      );
                      res(`${entity.display_name} has already been updated.`);
                      return;
                    }

                    const minDiff = moment
                      .duration(moment(lastRun).diff(comparison))
                      .asMinutes();
                    analysisLog(
                      strippedUnitName,
                      `Found ${minDiff} duration since last run.`
                    );
                    const past = -Math.round(minDiff / 5);
                    analysisLog(
                      strippedUnitName,
                      `This means ${past} iterations will be done.`
                    );

                    for (let i = past; i > 0; i -= 1) {
                      const mom2 = moment(mom).subtract(
                        5 * Math.round(entity.avg_stay_length_minutes / 5) +
                          5 * (past - 1),
                        "minutes"
                      );
                      const x =
                        (counts[`${mom2.valueOf()}`] || {})[strippedUnitName] ||
                        0;
                      analysisLog(
                        strippedUnitName,
                        `Found ${x} people from ${mom2.toString()} - ${mom2.valueOf()}.`
                      );
                      if (typeof x === "number") {
                        previousEntrants += x;
                      }
                    }
                  } else {
                    const mom2 = moment(mom).subtract(
                      5 * Math.round(entity.avg_stay_length_minutes / 5),
                      "minutes"
                    );
                    const x =
                      (counts[`${mom2.valueOf()}`] || {})[strippedUnitName] ||
                      0;
                    analysisLog(
                      strippedUnitName,
                      `Found (no multiple analysis) ${x} people from ${mom2.toString()} - ${mom2.valueOf()}.`
                    );
                    if (typeof x === "number") {
                      previousEntrants = x;
                    }
                  }

                  entrants = result || 0;

                  analysisLog(
                    strippedUnitName,
                    `Found ${entrants} from ${mom.toString()} - ${mom.valueOf()} in ${JSON.stringify(
                      result
                    )}.`
                  );
                }

                analysisLog(strippedUnitName, `Calculating density...`);
                analysisLog(strippedUnitName, `Current population: ${populi}`);
                const stickiness = Math.min(
                  (entity.stickiness || 100) / 100,
                  1
                );
                analysisLog(strippedUnitName, `Stickiness: ${stickiness}`);
                const additions = Math.ceil(stickiness * entrants);
                analysisLog(
                  strippedUnitName,
                  `Est. additions: ${additions} --- ${entrants}`
                );
                populi += additions;
                const max_capacity = entity.max_capacity || 100;
                const removals = Math.ceil(stickiness * previousEntrants);
                analysisLog(
                  strippedUnitName,
                  `Previous entrants: ${previousEntrants}  --- ${removals}`
                );
                populi -= removals;
                analysisLog(
                  strippedUnitName,
                  `Maximum capacity: ${max_capacity}`
                );
                // TODO Remove upper bounds check?
                populi = Math.max(0, Math.min(max_capacity, populi));

                const pp = populi / max_capacity;

                if (pp > (entity.high_density || 0.85)) {
                  density = 3;
                } else if (pp > (entity.medium_density || 0.75)) {
                  density = 2;
                } else if (pp > (entity.low_density || 0.5)) {
                  density = 1;
                } else {
                  density = 0;
                }

                analysisLog(strippedUnitName, `Density found: ${density}`);

                datastore.upsert(
                  {
                    key: densityKey,
                    data: {
                      id: strippedUnitName,
                      populi,
                      density,
                      lastRun: mom.valueOf(),
                    },
                  },
                  (err) => {
                    if (err) {
                      rej(err);
                    } else {
                      res(
                        `${entity.display_name} has approx. ${populi} individuals.`
                      );
                    }
                  }
                );
              });
            })
        )
      )
    )
  );
}

exports.handler = function analyse(event, callback) {
  return analyseData();
};

analyseData();
