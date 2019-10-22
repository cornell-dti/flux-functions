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

const allMenus = {};
setMenus = (json) => {
  const eateries = json.data.eateries;

  for (const eatery of eateries) {
    const weeksMenus = [];
    for (const openDay of eatery.operatingHours) {
      for (const openTime of openDay.events) {
        const menuData = openTime.menu;
        menu = [];
        for (const menuSection of menuData) {
          menu.push({
            category: menuSection.category,
            items: menuSection.items.map((items) => items.item)
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
      allMenus[eatery.slug] = {
        name: eatery.name,
        weeksMenus: weeksMenus
      };
    }
  }
}

async function getAllMenus() {
  console.log('Fetching dining data');
  try {
    await fetch("https://now.dining.cornell.edu/api/1.0/dining/eateries.json")
      .then(res => res.json())
      .then(json => this.setMenus(json));
    return allMenus;
  }
  catch (err) {
    console.error(err);
    return "error";
  }
}

async function getEateryMenus(slug) {
  let eateryMenus = [];
  await getAllMenus()
    .then(allMenus => {
      eateryMenus = allMenus[slug].weeksMenus;
    });
  return eateryMenus;
}

// [time] is unix epoch time in seconds
async function getEateryMenu(slug, time) {
  let menu = {};
  await getEateryMenus(slug)
    .then(eateryMenus => {
      for (const meal of eateryMenus) {
        const endTime = meal.endTime;
        if (time < endTime) {
          menu = meal.menu;
          break;
        }
      };
    });
  return menu;
}

// [time] is unix epoch time in seconds
async function getAllMealItems(slug, time) {
  let items = [];
  await getEateryMenu(slug, time)
    .then(menu => {
      for (const section of menu)
        items.push(section.items)
    });
  return [].concat.apply([], items);
}

async function test() {
  const now = Math.floor((new Date).getTime() / 1000);
  function hr(desc) {
    console.log("\n-----------------------------------\n" + desc + "\n");
  }
  await getEateryMenus('StraightMarket')
    .then(menus => {
      hr("getAllMenus");
      console.log(allMenus);
      hr("getEateryMenus");
      console.log(menus);
    })
  await getEateryMenu('Becker-House-Dining', now)
    .then(menu => {
      hr("getEateryMenu");
      console.log(menu);
    })
  await getAllMealItems('Becker-House-Dining', now)
    .then(items => {
      hr("getAllMealItems");
      console.log(items);
    })
}
test();

exports.handler = function menus(event, callback) {
  return getMenus();
};