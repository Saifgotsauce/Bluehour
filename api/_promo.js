// Shared by /api/checkout, /api/promo and /api/subscribe. The underscore keeps Vercel from serving it as a page.
// Looks up a Stripe promotion code (the code a customer types, like WELC10) and describes its discount.

// Pinned so the reply always has the same shape. Newer Stripe versions keep the coupon under promotion.coupon.
const STRIPE_VERSION = '2025-09-30.clover';

export const cleanCode = (c) => {
  const s = String(c == null ? '' : c).trim();
  return /^[A-Za-z0-9][A-Za-z0-9_-]{1,29}$/.test(s) ? s : '';
};

const dollars = (cents) => '$' + (cents % 100 ? (cents / 100).toFixed(2) : String(cents / 100));

export function describe(coupon, restrictions = {}) {
  let s = coupon.percent_off ? `${+coupon.percent_off}% off` : coupon.amount_off ? `${dollars(coupon.amount_off)} off` : 'A discount';
  if (restrictions.first_time_transaction) s += ' your first order';
  if (restrictions.minimum_amount) s += ` on orders over ${dollars(restrictions.minimum_amount)}`;
  return s;
}

// Returns { id, code, label } for a live code, or null.
export async function findPromo(code, key) {
  const c = cleanCode(code);
  if (!c || !key) return null;
  const q = new URLSearchParams({ code: c, active: 'true', limit: '1' });
  q.append('expand[]', 'data.promotion.coupon');
  const r = await fetch('https://api.stripe.com/v1/promotion_codes?' + q, {
    headers: { Authorization: `Bearer ${key}`, 'Stripe-Version': STRIPE_VERSION },
  });
  if (!r.ok) return null;
  const d = await r.json();
  const pc = d && Array.isArray(d.data) ? d.data[0] : null;
  if (!pc) return null;
  const coupon =
    (pc.promotion && pc.promotion.coupon && typeof pc.promotion.coupon === 'object' && pc.promotion.coupon) ||
    (pc.coupon && typeof pc.coupon === 'object' && pc.coupon) ||
    null;
  if (!coupon || coupon.valid === false) return null;
  if (pc.expires_at && pc.expires_at * 1000 < Date.now()) return null;
  if (pc.max_redemptions && pc.times_redeemed >= pc.max_redemptions) return null;
  const rs = pc.restrictions || {};
  return {
    id: pc.id,
    code: pc.code,
    label: describe(coupon, rs),
    percent: +coupon.percent_off || 0,
    amount: +coupon.amount_off || 0,
    minimum: +rs.minimum_amount || 0,
  };
}

// What a code would save on an order, in cents (so checkout can pick the shopper's best discount).
export function promoValue(promo, subtotalCents) {
  if (!promo || subtotalCents < promo.minimum) return 0;
  if (promo.percent) return Math.round((subtotalCents * promo.percent) / 100);
  return Math.min(promo.amount, subtotalCents);
}

export function queryParam(req, name) {
  if (req.query && req.query[name] != null) return String(req.query[name]);
  try { return new URL(req.url, 'http://x').searchParams.get(name) || ''; } catch (e) { return ''; }
}
