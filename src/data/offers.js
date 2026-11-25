// Offers that run alongside the founding price.

// Founding price: only the first FOUNDING_LIMIT paid pre-orders get it. /api/founding counts them, the shop shows
// how many are left, and /api/checkout stops taking founding orders once they're gone (then switch PREORDER off).
export const FOUNDING_LIMIT = 100;

// Instagram followers' code: $10 off one order, for the first FOLLOWER_LIMIT people who use it.
// Shared in stories and DMs as a link: bluehournights.com/shop?code=FOLLOWER10
// Stripe enforces the limit (the coupon has max_redemptions). Works during pre-order. Doesn't combine with Crew codes.
export const FOLLOWER_CODE = 'FOLLOWER10';
export const FOLLOWER_OFF = 10;
export const FOLLOWER_LIMIT = 100;
export const isFollowerCode = (c) => String(c || '').trim().toUpperCase() === FOLLOWER_CODE;
