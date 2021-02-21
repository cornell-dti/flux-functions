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

const DataStorage = require('./functions/daily-storage');
const Analysis = require('./functions/analysis');
const Auth = require('./functions/auth');
const UpdateHours = require('./functions/update-hours');
const DiningData = require('./functions/dining');
const WaitTime = require('./functions/wait-time');

exports.updateData = DataStorage.handler;
exports.analyse = Analysis.handler;
exports.authv1 = Auth.handler;
exports.updateHoursDev = UpdateHours.handler;
exports.diningData = DiningData.handler;
exports.waitTime = WaitTime.handler;
