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

// Founding offer (docs/FUNNEL.md). The founding prices are an introductory offer for the first FOUNDING_CAP paid
// orders. FTC rules (16 CFR 233): never show $129 crossed out until $129 has really been charged, and the cap must
// be real. When order #100 is paid, the price must go to the launch prices and stay there.
export const FOUNDING_CAP = 100;
export const SHIP_BY_FULL = 'Sunday, December 20, 2026';
