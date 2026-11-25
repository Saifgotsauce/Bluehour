// Shared by /api/checkout, /api/promo and /api/founding. The underscore keeps Vercel from serving it as a page.
import { stripe } from './_crew.js';
import { FOLLOWER_OFF, FOLLOWER_LIMIT, FOUNDING_LIMIT } from '../src/data/offers.js';
import { PREORDER } from '../src/data/preorder.js';

const FOLLOWER_COUPON = 'bh-followers-10';

// The followers' coupon, made the first time it's needed. Returns its id while uses are left, else null.
export async function followerCoupon(key) {
  let got = await stripe(key, 'coupons/' + FOLLOWER_COUPON);
  if (!got.ok) {
    const made = await stripe(key, 'coupons', {
      method: 'POST',
      params: new URLSearchParams({
        id: FOLLOWER_COUPON, amount_off: String(FOLLOWER_OFF * 100), currency: 'usd', duration: 'once',
        max_redemptions: String(FOLLOWER_LIMIT), name: `Followers: $${FOLLOWER_OFF} off`,
      }),
    });
    if (!made.ok && !(made.d.error && made.d.error.code === 'resource_already_exists')) {
      console.error('Could not make the followers coupon:', made.d.error ? made.d.error.message : made.status);
      return null;
    }
    got = made.ok ? made : await stripe(key, 'coupons/' + FOLLOWER_COUPON);
  }
  const c = got.d || {};
  if (c.valid === false) return null;
  if (c.max_redemptions && c.times_redeemed >= c.max_redemptions) return null;
  return FOLLOWER_COUPON;
}

// How many founding (pre-order) orders have been paid. Stops counting at the limit.
export async function foundingSold(key) {
  let n = 0;
  let after = '';
  for (let page = 0; page < 5 && n < FOUNDING_LIMIT; page++) {
    const q = new URLSearchParams({ status: 'complete', limit: '100' });
    if (after) q.set('starting_after', after);
    const r = await stripe(key, 'checkout/sessions?' + q);
    if (!r.ok) throw new Error('stripe ' + r.status);
    const list = r.d.data || [];
    n += list.filter((s) => s.metadata && s.metadata.preorder === 'yes' && s.payment_status === 'paid').length;
    if (!r.d.has_more || !list.length) break;
    after = list[list.length - 1].id;
  }
  return Math.min(n, FOUNDING_LIMIT);
}

export const foundingLeft = async (key) => (PREORDER ? FOUNDING_LIMIT - (await foundingSold(key)) : 0);
