// Founding offer and ordering mode.
// (If you change DELIVERY or the founding prices, also update src/pages/refunds.md, shipping.md and terms.md,
// which are plain text.)
//
// We sell straight orders now (no pre-order). Rolls are packed to order and drop-shipped by OK Capsule.
//
// While FOUNDING is true:
// - rolls sell at the founding prices in ingredients.js (FOUNDING_TIERS), next to the crossed-out launch price
// - checkout stops selling at the founding price once FOUNDING_CAP paid orders exist (api/checkout.js)
// - discount codes, the welcome offer pop-up and the easter eggs are off (the founding price is the deal);
//   Founding Crew codes still work
// When order #100 is paid: set FOUNDING to false and push. Prices go to $129 / $119 / $109 for real.
export const FOUNDING = true;
export const FOUNDING_CAP = 100;

// Kept false. Pre-order wording (ship-by date, "refund before it ships") is gone from the site.
export const PREORDER = false;

// How long delivery takes, start to finish (packing plus shipping). Shown on the site and at checkout.
export const DELIVERY = '5 to 9 days'; // founder: delivered in 7 to 10 days max, so we promise 5 to 9
export const DELIVERY_MAX_DAYS = 10;

// Old pre-order ship date. Only used to work out Crew commission timing on orders placed during pre-order.
export const SHIP_BY = 'December 20';
export const SHIP_BY_FULL = 'Sunday, December 20, 2026';
