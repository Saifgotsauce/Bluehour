// Founding Crew codes and payouts. The underscore keeps Vercel from serving it as a page.
//
// How it fits together
// - Every ambassador is a Stripe promotion code (their code, like MAYA5) on one coupon: bh-crew-5. At checkout the
//   order gets $5 off each roll (a coupon made for that roll count), and crew_code says who sent them.
//   The promotion code's metadata holds who they are: crew=1, name, email, ship (their address, used to
//   catch self-referrals), paypal, and paid (cents paid out so far). Switching the code off in Stripe stops it at once.
// - Checkout writes crew_code on every order that uses one.
// - ledger() works out what each ambassador has earned from Stripe's own records, so nothing can be faked from the
//   browser: refunds, disputes, self-referrals and repeat buyers are taken out, and every order must leave
//   Blue Hour a profit after the commission.

import crypto from 'node:crypto';
import {
  CREW_OFF, CREW_RATE, BOOST_AT, BOOST_RATE, FREE_ROLL_AT, ROLL_COST_MAX, MIN_KEEP_PER_ROLL,
  STRIPE_PCT, STRIPE_FIXED, HOLD_AFTER_SHIP_DAYS, HOLD_DAYS, REPEAT_DAYS, cleanCrewCode,
} from '../src/data/crew.js';

export const CREW_COUPON = 'bh-crew-5';
const STRIPE_VERSION = '2025-09-30.clover';
const DAY = 864e5;

export const stripe = async (key, path, { method = 'GET', params } = {}) => {
  const url = 'https://api.stripe.com/v1/' + path + (method === 'GET' && params ? '?' + params : '');
  const r = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${key}`, 'Stripe-Version': STRIPE_VERSION, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: method === 'GET' ? undefined : params,
  });
  const d = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, d };
};

// $5 off each roll: one coupon per roll count (bh-crew-5-x3 is $15 off), made the first time it's needed.
// Stripe coupons take a fixed amount off the order, so the roll count is built into the coupon.
const madeRolls = new Set();
export async function crewCouponFor(rolls, key) {
  const n = Math.max(1, Math.min(9, Math.floor(rolls) || 1));
  const id = `${CREW_COUPON}-x${n}`;
  if (madeRolls.has(id)) return id;
  const made = await stripe(key, 'coupons', {
    method: 'POST',
    params: new URLSearchParams({ id, amount_off: String(CREW_OFF * 100 * n), currency: 'usd', duration: 'once', name: `Founding Crew: $${CREW_OFF} off each roll` }),
  });
  if (made.ok || (made.d.error && made.d.error.code === 'resource_already_exists')) { madeRolls.add(id); return id; }
  console.error('Could not make the crew coupon:', made.d.error ? made.d.error.message : made.status);
  return null;
}

// The coupon every ambassador's promotion code hangs off (it marks the code as a crew code). Made the first time it's needed.
let couponReady = false;
export async function ensureCrewCoupon(key) {
  if (couponReady) return true;
  const got = await stripe(key, 'coupons/' + CREW_COUPON);
  if (got.ok) return (couponReady = true);
  const made = await stripe(key, 'coupons', {
    method: 'POST',
    params: new URLSearchParams({ id: CREW_COUPON, amount_off: String(CREW_OFF * 100), currency: 'usd', duration: 'once', name: `Founding Crew: $${CREW_OFF} off` }),
  });
  if (made.ok || (made.d.error && made.d.error.code === 'resource_already_exists')) return (couponReady = true);
  console.error('Could not make the crew coupon:', made.d.error ? made.d.error.message : made.status);
  return false;
}

const couponOf = (pc) =>
  (pc.promotion && pc.promotion.coupon && (pc.promotion.coupon.id || pc.promotion.coupon)) ||
  (pc.coupon && (pc.coupon.id || pc.coupon)) || '';

export const isCrewPromo = (pc) => !!pc && couponOf(pc) === CREW_COUPON && pc.metadata && pc.metadata.crew === '1';

export function crewFromPromo(pc) {
  const m = pc.metadata || {};
  return {
    id: pc.id, code: pc.code, active: !!pc.active, name: m.name || '', email: (m.email || '').toLowerCase(),
    ship: m.ship || '', paypal: m.paypal || '', paidCents: parseInt(m.paid, 10) || 0, freeSent: m.free_roll === 'sent', created: (pc.created || 0) * 1000,
  };
}

// A live crew code, or null. Used by /api/promo and /api/checkout.
export async function findCrew(code, key) {
  const c = cleanCrewCode(code);
  if (!c || !key) return null;
  const q = new URLSearchParams({ code: c, active: 'true', limit: '1' });
  const r = await stripe(key, 'promotion_codes', { params: q });
  const pc = r.ok && r.d.data ? r.d.data[0] : null;
  return isCrewPromo(pc) ? crewFromPromo(pc) : null;
}

export async function listCrew(key) {
  const out = [];
  let after = '';
  for (let i = 0; i < 20; i++) {
    const q = new URLSearchParams({ limit: '100' });
    if (after) q.set('starting_after', after);
    const r = await stripe(key, 'promotion_codes', { params: q });
    if (!r.ok) throw new Error('stripe_promos_' + r.status);
    r.d.data.filter(isCrewPromo).forEach((pc) => out.push(crewFromPromo(pc)));
    if (!r.d.has_more || !r.d.data.length) break;
    after = r.d.data[r.d.data.length - 1].id;
  }
  return out;
}

// Every finished checkout that used a crew code, with the payment details needed to check it.
export async function listCrewOrders(key) {
  const out = [];
  let after = '';
  for (let i = 0; i < 30; i++) {
    const q = new URLSearchParams({ limit: '100', status: 'complete' });
    q.append('expand[]', 'data.payment_intent.latest_charge');
    if (after) q.set('starting_after', after);
    const r = await stripe(key, 'checkout/sessions', { params: q });
    if (!r.ok) throw new Error('stripe_sessions_' + r.status);
    r.d.data.forEach((s) => { const o = toOrder(s); if (o) out.push(o); });
    if (!r.d.has_more || !r.d.data.length) break;
    after = r.d.data[r.d.data.length - 1].id;
  }
  return out;
}

export const normAddress = (a) => {
  if (!a) return '';
  const line = String(a.line1 || '').toLowerCase().replace(/[^a-z0-9]/g, '')
    .replace(/(street|st)$/, 'st').replace(/(avenue|ave)$/, 'ave');
  const zip = String(a.postal_code || '').replace(/[^0-9a-z]/gi, '').slice(0, 5).toLowerCase();
  return line && zip ? line + '|' + zip : '';
};

// Turns a Stripe checkout session into the few facts the ledger needs. Returns null for orders without a code.
export function toOrder(s) {
  const m = s.metadata || {};
  const code = cleanCrewCode(m.crew_code);
  if (!code || s.payment_status !== 'paid') return null;
  const pi = s.payment_intent && typeof s.payment_intent === 'object' ? s.payment_intent : {};
  const ch = pi.latest_charge && typeof pi.latest_charge === 'object' ? pi.latest_charge : {};
  const shipTo = (s.collected_information && s.collected_information.shipping_details) || s.shipping_details || {};
  return {
    id: s.id,
    code,
    at: (s.created || 0) * 1000,
    rolls: Math.max(1, parseInt(m.rolls, 10) || 1),
    paidCents: s.amount_total || 0,
    email: ((s.customer_details && s.customer_details.email) || '').toLowerCase(),
    name: (shipTo.name || (s.customer_details && s.customer_details.name) || '').trim(),
    ship: normAddress(shipTo.address),
    card: (ch.payment_method_details && ch.payment_method_details.card && ch.payment_method_details.card.fingerprint) || '',
    refunded: (ch.amount_refunded || 0) > 0 || ch.refunded === true,
    disputed: ch.disputed === true,
    preorder: m.preorder === 'yes',
    shipBy: m.ship_by || '',
  };
}

const fee = (cents) => Math.round(cents * STRIPE_PCT + STRIPE_FIXED * 100);

// When an order's commission can be counted: pre-orders some days after they ship, others some days after ordering.
export function countsFrom(o, shipByFull) {
  if (o.preorder) {
    const t = Date.parse(o.shipBy && /\d{4}/.test(o.shipBy) ? o.shipBy : shipByFull);
    if (!isNaN(t)) return t + HOLD_AFTER_SHIP_DAYS * DAY;
  }
  return o.at + HOLD_DAYS * DAY;
}

// The whole ledger. crews: from listCrew. orders: from listCrewOrders (any order, any code).
// Returns one entry per ambassador with every order's status and the reason for it.
export function ledger(crews, orders, { now = Date.now(), shipByFull = '' } = {}) {
  const byCode = new Map(crews.map((c) => [c.code, { ...c, orders: [], earnedRolls: 0, earnedCents: 0, heldCents: 0, keptCents: 0, freeRoll: 'not yet' }]));
  // The ambassador's own fingerprints: any card used on an order shipped to them or paid with their email.
  const ownCards = new Map();
  crews.forEach((c) => {
    const set = new Set();
    orders.forEach((o) => { if (o.card && ((c.email && o.email === c.email) || (c.ship && o.ship === c.ship))) set.add(o.card); });
    ownCards.set(c.code, set);
  });
  const sorted = [...orders].sort((a, b) => a.at - b.at);
  const lastSeen = new Map(); // code|buyer-key -> time of the last counted order
  for (const o of sorted) {
    const c = byCode.get(o.code);
    if (!c) continue; // code no longer exists: nothing to pay
    const row = { ...o, status: '', why: '', commissionCents: 0 };
    c.orders.push(row);
    const nameMatch = c.name && o.name && o.name.toLowerCase().replace(/\s+/g, ' ') === c.name.toLowerCase().replace(/\s+/g, ' ');
    if (o.refunded) { row.status = 'void'; row.why = 'Refunded'; continue; }
    if (o.disputed) { row.status = 'void'; row.why = 'Disputed with the bank'; continue; }
    if ((c.email && o.email === c.email) || (c.ship && o.ship && o.ship === c.ship) || (o.card && ownCards.get(o.code).has(o.card)) || nameMatch) {
      row.status = 'void'; row.why = 'Their own order (same email, address, card or name)'; continue;
    }
    const buyers = [o.email && 'e:' + o.email, o.ship && 's:' + o.ship, o.card && 'c:' + o.card].filter(Boolean);
    const repeat = buyers.some((b) => { const t = lastSeen.get(o.code + '|' + b); return t && o.at - t < REPEAT_DAYS * DAY; });
    if (repeat) { row.status = 'void'; row.why = `Same buyer again within ${REPEAT_DAYS} days`; continue; }
    buyers.forEach((b) => lastSeen.set(o.code + '|' + b, o.at));

    // Commission for this order's rolls at the ambassador's current tier, then the profit floor.
    let raw = 0;
    for (let i = 1; i <= o.rolls; i++) raw += (c.earnedRolls + i > BOOST_AT ? BOOST_RATE : CREW_RATE) * 100;
    const margin = o.paidCents - fee(o.paidCents) - o.rolls * ROLL_COST_MAX * 100;
    const allowed = Math.max(0, margin - o.rolls * MIN_KEEP_PER_ROLL * 100);
    row.commissionCents = Math.min(raw, allowed);
    if (row.commissionCents < raw) row.why = 'Capped so the order stays profitable';
    const ready = countsFrom(o, shipByFull) <= now;
    row.status = ready ? 'earned' : 'held';
    if (!ready) {
      row.why = (row.why ? row.why + '. ' : '') + 'Counts from ' + new Date(countsFrom(o, shipByFull)).toISOString().slice(0, 10);
      c.heldCents += row.commissionCents;
      continue;
    }
    c.earnedRolls += o.rolls;
    c.earnedCents += row.commissionCents;
    c.keptCents += margin - row.commissionCents;
  }
  for (const c of byCode.values()) {
    // The free roll: once, after FREE_ROLL_AT earned rolls, and only once the profit kept on their orders covers it.
    if (c.freeSent) c.freeRoll = 'sent';
    else if (c.earnedRolls >= FREE_ROLL_AT) c.freeRoll = c.keptCents >= ROLL_COST_MAX * 100 ? 'due' : 'waiting on more profit';
    c.owedCents = c.earnedCents - c.paidCents; // negative after a refund or dispute on an order already paid out
  }
  return [...byCode.values()];
}

// The private link to an ambassador's own dashboard (/me?c=CODE&t=TOKEN). The token is signed with CREW_ADMIN_KEY,
// so nobody can guess someone else's link, and it can't be turned back into the admin key.
export function dashToken(code) {
  const secret = process.env.CREW_ADMIN_KEY || '';
  if (secret.length < 16 || !code) return '';
  return crypto.createHmac('sha256', secret).update('crew-dash:' + code).digest('base64url').slice(0, 22);
}
export const dashPath = (code) => `/me?c=${encodeURIComponent(code)}&t=${dashToken(code)}`;
export function dashOk(code, token) {
  const want = dashToken(code);
  const got = String(token || '');
  return !!want && got.length === want.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want));
}
