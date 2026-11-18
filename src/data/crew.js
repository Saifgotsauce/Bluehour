// Founding Crew: the ambassador program. Change the numbers here and the /crew page follows.
//
// The maths per roll, at the worst case (a single pre-order roll with a crew code):
//   $99 founding price - $5 crew discount = $94 paid
//   - about $3 Stripe fee - up to $60 OK Capsule cost - $10 commission  =  about $21 left for Blue Hour
// The free roll costs about $40-60 to make and is only earned after 5 sales (about $105 kept by then),
// and the $12 rate only starts after 15 sales.

export const CREW_SPOTS = 50;        // how many people get in
export const CREW_OFF = 5;           // what a friend saves on each roll with a crew code, in dollars
export const CREW_RATE = 10;         // commission per roll sold, in dollars
export const FREE_ROLL_AT = 5;       // rolls sold to earn a free roll
export const BOOST_AT = 15;          // rolls sold before the higher rate starts
export const BOOST_RATE = 12;        // commission per roll after BOOST_AT, in dollars

// What someone earns for a number of rolls sold.
export function crewEarnings(rolls) {
  const n = Math.max(0, Math.floor(rolls) || 0);
  return Math.min(n, BOOST_AT) * CREW_RATE + Math.max(0, n - BOOST_AT) * BOOST_RATE;
}

// A code people can share: letters and numbers only, 3 to 12 characters.
export const cleanCrewCode = (c) => {
  const s = String(c == null ? '' : c).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return s.length >= 3 && s.length <= 12 ? s : '';
};
