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
function setMenus(json) {
  const { eateries } = json.data;

  for (const eatery of eateries) {
    const weeksMenus = [];
    for (const openDay of eatery.operatingHours) {
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
          weeksMenus.push({
            description: openTime.descr,
            startTime: openTime.startTimestamp,
            endTime: openTime.endTimestamp,
            menu
          });
        }
      }
    }
    if (weeksMenus.length !== 0) {
      allMenus[eatery.slug] = {
        name: eatery.name,
        campusArea: eatery.campusArea.descrshort,
        coordinates: eatery.coordinates,
        weeksMenus
      };
    }
  }
}

async function getAllMenus() {
  console.log('Fetching dining data');
  try {
    await fetch('https://now.dining.cornell.edu/api/1.0/dining/eateries.json')
      .then(res => res.json())
      .then(json => setMenus(json));
    return allMenus;
  } catch (err) {
    console.error(err);
    return false;
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
async function getEateryUpcomingMenu(slug, time) {
  let mealStartTime = 0;
  const menu = {};
  await getEateryMenus(slug)
    .then(eateryMenus => {
      for (const meal of eateryMenus) {
        if (time < meal.endTime) {
          menu[meal.description] = meal.menu;
          mealStartTime = meal.startTime;
          break;
        }
      }
    });
  return {
    date: new Date(mealStartTime * 1000),
    content: menu
  };
}

// [time] is unix epoch time in seconds
async function getEateryDayMenus(slug, time) {
  const date = new Date(time * 1000);
  let menus = {};
  await getEateryMenus(slug)
    .then(eateryMenus => {
      let lastMealEndTime = 0;
      for (const meal of eateryMenus) {
        const mealDay = new Date(meal.startTime * 1000).getDay();
        if (date.getDay() === mealDay) {
          menus[meal.description] = meal.menu;
          lastMealEndTime = meal.endTime;
        }
      }
      if (time > lastMealEndTime) {
        const tomorrow = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
        const tomorrowTime = Math.floor(tomorrow.getTime() / 1000);
        menus = getEateryDayMenus(slug, tomorrowTime).menus;
      }
    });
  return {
    date,
    menus
  };
}

// [time] is unix epoch time in seconds
async function getAllMealItems(slug, time) {
  const items = [];
  await getEateryUpcomingMenu(slug, time)
    .then(menu => {
      const { content } = menu;
      for (const description of Object.keys(content)) {
        const menu = content[description];
        for (const section of menu) {
          for (const item of section.items) {
            items.push(item);
          }
        }
      }
    });
  return items;
}

async function getAllItems() {
  const items = new Set([]);
  await getAllMenus()
    .then(allMenus => {
      for (const slug of Object.keys(allMenus)) {
        const eatery = allMenus[slug];
        const eateryMenus = eatery.weeksMenus;
        for (const meal of eateryMenus) {
          for (const section of meal.menu) {
            for (const item of section.items) {
              items.add(item);
            }
          }
        }
      }
    });
  return items;
}

async function test() {
  const now = Math.floor(Date.now() / 1000);
  function hr(desc) {
    console.log('\n-----------------------------------');
    console.log(desc);
    console.log('\n');
  }
  await getEateryMenus('Becker-House-Dining')
    .then(menus => {
      hr('getAllMenus');
      console.log(allMenus);
      hr('getEateryMenus');
      console.log(menus);
    });
  await getEateryUpcomingMenu('Becker-House-Dining', now)
    .then(menu => {
      hr('getEateryUpcomingMenu');
      console.log(menu);
    });
  await getEateryDayMenus('Becker-House-Dining', now)
    .then(menus => {
      hr('getEateryDayMenus');
      console.log(menus);
    });
  await getAllMealItems('Becker-House-Dining', now)
    .then(items => {
      hr('getAllMealItems');
      console.log(items);
    });
  await getAllItems()
    .then(items => {
      hr('getAllItems');
      console.log(items);
    });
}
// test();
