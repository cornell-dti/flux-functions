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

const fetch = require('node-fetch');

const menus = {};
setMenus = (json) => {
  const eateries = json.data.eateries;

  for (const eatery of eateries) {
    const weeksMenus = [];
    for (const openDay of eatery.operatingHours) {
      for (const openTime of openDay.events) {
        const menuData = openTime.menu;
        menu = []
        for (const menuSection of menuData) {
          menu.push({
            category: menuSection.category,
            items: menuSection.items
          })
        }
        if (menu.length !== 0) {
          weeksMenus.push({
            description: openTime.descr,
            startTime: openTime.startTimestamp,
            endTime: openTime.endTimestamp,
            menu: menu
          })
        }
      };
    }
    if (weeksMenus.length !== 0) {
      menus[eatery.slug] = {
        name: eatery.name,
        weeksMenus: weeksMenus
      };
    }
  }
}

async function getMenus() {
  console.log('Fetching dining data');

  try {
    await fetch("https://now.dining.cornell.edu/api/1.0/dining/eateries.json")
      .then(res => res.json())
      .then(json => this.setMenus(json));
    return menus;
  }
  catch (err) {
    console.error(err);
    return "error";
  }
}

async function menu(slug) {
  menu = []
  await getMenus()
    .then(menus => {
      menu = menus[slug].weeksMenus[0];
    });
  return menu;
}

async function test() {
  await menu('StraightMarket')
    .then(menu => {
      console.log(menus)
      console.log(menu)
    })
}
test();

exports.handler = function menus(event, callback) {
  return getMenus();
};