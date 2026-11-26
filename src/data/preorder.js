// Pre-order mode. While PREORDER is true:
// (If you change SHIP_BY or the founding prices, also update the dates and prices written in src/pages/refunds.md,
// shipping.md and terms.md, which are plain text.)
// - rolls sell at the founding prices in ingredients.js (PREORDER_TIERS), charged in full at checkout
// - every buy button says pre-order, and checkout, the thank-you page and the policies explain the ship date
// - discount codes, the welcome offer pop-up and the easter eggs are switched off (the founding price is the deal)
// At launch: set PREORDER to false and push. Everything goes back to the launch prices and the normal shop.
export const PREORDER = true;

// The date every pre-order ships by. Customers are promised a full refund any time before their roll ships,
// and if we can't ship by this date we must email them before it passes, give a new date, and offer a full refund.
export const SHIP_BY = 'December 20';

// Founding offer (docs/FUNNEL.md). The founding prices are for the first FOUNDING_CAP paid orders, shown next to the
// crossed-out launch price (founder's decision). Keep it true: the cap must be real, and once order #100 is paid the
// launch prices ($129 / $119 / $109) must become the real prices.
export const FOUNDING_CAP = 100;
export const SHIP_BY_FULL = 'Sunday, December 20, 2026';
