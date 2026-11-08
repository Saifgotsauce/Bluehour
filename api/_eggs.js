// Signs and checks easter egg discounts. The underscore keeps Vercel from serving it as a page.
// A found egg is a signed token the shopper's browser keeps; /api/checkout only trusts tokens it signed.

import crypto from 'node:crypto';
import { eggById, eggAmount, EGG_DAYS } from '../src/data/eggs.js';

const secret = () => (process.env.EGG_SECRET || process.env.STRIPE_SECRET_KEY || '') + ':bh-eggs';
const sign = (body) => crypto.createHmac('sha256', secret()).update(body).digest('base64url');

export function signEgg(id, now = Date.now()) {
  const body = Buffer.from(JSON.stringify({ e: id, x: now + EGG_DAYS * 864e5 })).toString('base64url');
  return body + '.' + sign(body);
}

// Returns { id, name, amount, expires } for a genuine, unexpired token, or null.
export function readEgg(token, now = Date.now()) {
  if (typeof token !== 'string' || token.length > 400) return null;
  const [body, s] = token.split('.');
  if (!body || !s) return null;
  const want = sign(body);
  if (s.length !== want.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(want))) return null;
  let d;
  try { d = JSON.parse(Buffer.from(body, 'base64url').toString()); } catch (e) { return null; }
  const egg = d && eggById(d.e);
  if (!egg || !(d.x > now)) return null;
  return { id: egg.id, name: egg.name, amount: eggAmount(egg.id), expires: d.x };
}

// Each egg has its own Stripe coupon, made the first time it's used, so it shows by name at checkout
// ("Night 30 egg: $10 off") and Stripe reports show how many orders each egg brought in.
const made = new Set();
export async function eggCoupon(egg, key) {
  const id = `bh-egg-${egg.id}-${egg.amount}`;
  if (made.has(id)) return id;
  const p = new URLSearchParams({
    id,
    amount_off: String(egg.amount * 100),
    currency: 'usd',
    duration: 'once',
    name: `${egg.name} egg: $${egg.amount} off`.slice(0, 40),
  });
  const r = await fetch('https://api.stripe.com/v1/coupons', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: p,
  });
  if (r.ok) { made.add(id); return id; }
  const d = await r.json().catch(() => ({}));
  if (d && d.error && d.error.code === 'resource_already_exists') { made.add(id); return id; }
  console.error('Could not make egg coupon:', d && d.error ? d.error.message : r.status);
  return null;
}
