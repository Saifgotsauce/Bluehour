// Founding Crew: the ambassador program. Change the numbers here and the /crew page and payouts follow.
//
// Every order with a crew code is checked against a profit floor before any commission is counted
// (see api/_crew.js). Worst case per order, using the most an OK Capsule roll can cost:
//   1 roll:  $99 - $5 code = $94  - ~$3.03 Stripe - $60 - $10 commission = ~$21 kept
//   3 rolls: $267 - $15 = $252    - ~$7.61 Stripe - $180 - $30          = ~$34 kept (~$11.50 a roll)
// At the $129 launch price there's far more room. If an order would ever leave less than MIN_KEEP_PER_ROLL,
// the commission on it is cut to fit, so no order can lose money.
// The free roll (worth up to $60 to make) is only given once the ambassador's earned orders have left
// at least that much profit on top of the floor, so it can never put the program in the red.

export const CREW_SPOTS = 50;        // how many people get in
export const CREW_OFF = 5;           // what a friend saves on each roll with a crew code, in dollars
export const CREW_RATE = 10;         // commission per roll, in dollars
export const FREE_ROLL_AT = 5;       // earned rolls before the one-time free roll
export const FIRST_BONUS = 10;       // one-time extra on an ambassador's first counted order, in dollars (so the first roll pays $20)
export const BOOST_AT = 15;          // earned rolls before the higher rate starts
export const BOOST_RATE = 12;        // commission per roll after BOOST_AT, in dollars

// Rules the payout report enforces (not shown on the site as numbers you can game).
export const ROLL_COST_MAX = 60;     // most a roll costs us to make and ship, in dollars
export const MIN_KEEP_PER_ROLL = 8;  // profit we always keep per roll after the commission, in dollars
export const STRIPE_PCT = 0.029;     // Stripe card fee
export const STRIPE_FIXED = 0.3;
export const HOLD_AFTER_SHIP_DAYS = 14; // pre-orders: commission counts this many days after the ship-by date
export const HOLD_DAYS = 30;         // after launch: commission counts this many days after the order
export const REPEAT_DAYS = 30;       // one counted order per buyer per code in this many days

// What someone earns for a number of earned rolls (before the profit floor, which only ever lowers it).
// Includes the one-time first-order bonus.
export function crewEarnings(rolls) {
  const n = Math.max(0, Math.floor(rolls) || 0);
  return (n ? FIRST_BONUS : 0) + Math.min(n, BOOST_AT) * CREW_RATE + Math.max(0, n - BOOST_AT) * BOOST_RATE;
}

// A code people can share: letters and numbers only, 3 to 12 characters.
export const cleanCrewCode = (c) => {
  const s = String(c == null ? '' : c).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return s.length >= 3 && s.length <= 12 ? s : '';
};
