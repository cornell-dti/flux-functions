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

const DataStorage = require('./daily-storage');
const Analysis = require('./analysis');
const Density = require('./density');
const Auth = require('./auth');
const UpdateHours = require('./update-hours');
const HistoricalData = require('./history');

exports.howDense = Auth.authenticated(Density.howDense);
exports.facilityList = Auth.authenticated(Density.facilityList);
exports.facilityInfo = Auth.authenticated(Density.facilityInfo);
exports.historicalData = Auth.authenticated(HistoricalData.handler);
exports.updateData = DataStorage.handler;
exports.analyse = Analysis.handler;
exports.updateHours = UpdateHours.handler;
exports.authv1 = Auth.handler;