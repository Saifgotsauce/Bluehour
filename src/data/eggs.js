// Hidden discounts around the site ("easter eggs"). Shared by the site and the server.
//
// How they're sorted: the harder an egg is to find, the more it's worth.
//   common $5, rare $10, legendary $15.
// How they protect profit: an order only ever gets its single best discount (an egg OR a code, never both),
// and the biggest egg is $15. So even if someone finds every egg, a 1-roll order still keeps about $50
// after OK Capsule ($60 worst case) and Stripe fees.
// An egg's discount lasts EGG_DAYS after it's found.

export const EGG_DAYS = 2;
export const RARITY = { common: 5, rare: 10, legendary: 15 };
export const BLUE_HOUR = [5, 7]; // shopper's local time, 5:00 to 6:59 am
export const COLLECTOR_NEEDS = 3; // find this many other eggs to unlock the collector egg

export const EGGS = [
  { id: 'toss', rarity: 'common', name: 'Capsule toss', found: 'You flicked every capsule on the page.' },
  { id: 'lights', rarity: 'common', name: 'Lights up', found: 'You found the light switch.' },
  { id: 'night30', rarity: 'rare', name: 'Night 30', found: 'You made it to the last night.' },
  { id: 'reader', rarity: 'rare', name: 'Read to the end', found: 'You read all the way to the end.' },
  { id: 'plur', rarity: 'rare', name: 'PLUR', found: 'Peace, love, unity, respect.' },
  { id: 'bluehour', rarity: 'legendary', name: 'Blue hour', found: "You're up at blue hour." },
  { id: 'collector', rarity: 'legendary', name: 'Collector', found: 'Three eggs found. You get the big one.' },
];

export const eggById = (id) => EGGS.find((e) => e.id === id) || null;
export const eggAmount = (id) => { const e = eggById(id); return e ? RARITY[e.rarity] : 0; };
export const inBlueHour = (hour) => hour >= BLUE_HOUR[0] && hour < BLUE_HOUR[1];
