// POST /api/checkout
// Turns the cart into a Stripe Checkout page. Prices and pouch limits are re-checked here, so the
// browser can't change what an order costs or what goes into a pouch.
// Needs STRIPE_SECRET_KEY in Vercel (Settings > Environment Variables). Use the sk_test_ key first.

import { PRICE, INGREDIENTS, cleanMix, mixTotal, isSignature, eachFor, savingFor, tierFor, totalFor } from '../src/data/ingredients.js';
import { findPromo, promoValue } from './_promo.js';
import { readEgg, eggCoupon } from './_eggs.js';
import { PREORDER, SHIP_BY } from '../src/data/preorder.js';

const MAX_LINES = 8;
const MAX_QTY = 9;

// Ingredient names, so each order says exactly what to pack in OK Capsule.
export const packList = (mix) =>
  INGREDIENTS.filter((i) => mix[i.id]).map((i) => i.ingredient + (mix[i.id] > 1 ? ' x' + mix[i.id] : '')).join(', ');

export function cleanLines(lines) {
  if (!Array.isArray(lines)) return [];
  return lines
    .slice(0, MAX_LINES)
    .map((l) => ({
      mix: cleanMix(l && l.mix),
      qty: Math.max(1, Math.min(MAX_QTY, parseInt(l && l.qty, 10) || 1)),
    }))
    .filter((l) => mixTotal(l.mix) > 0);
}

// disc: { promo: promotion code ID } or { coupon: coupon ID } to apply up front.
// Without one, shoppers can type a code on the Stripe page.
export function sessionParams(lines, origin, disc) {
  const rolls = lines.reduce((a, l) => a + l.qty, 0);
  const each = eachFor(rolls);
  const saving = savingFor(rolls);
  const tier = tierFor(rolls);

  const p = new URLSearchParams();
  p.set('mode', 'payment');
  p.set('success_url', `${origin}/thank-you?session_id={CHECKOUT_SESSION_ID}`);
  p.set('cancel_url', `${origin}/shop`);
  p.set('shipping_address_collection[allowed_countries][0]', 'US');
  // Pre-orders are already at the founding price, so no codes: the Stripe page shows no code box at all.
  if (disc && disc.promo) p.set('discounts[0][promotion_code]', disc.promo);
  else if (disc && disc.coupon) p.set('discounts[0][coupon]', disc.coupon);
  else if (!PREORDER) p.set('allow_promotion_codes', 'true');
  p.set('shipping_options[0][shipping_rate_data][type]', 'fixed_amount');
  p.set('shipping_options[0][shipping_rate_data][fixed_amount][amount]', '0');
  p.set('shipping_options[0][shipping_rate_data][fixed_amount][currency]', 'usd');
  p.set('shipping_options[0][shipping_rate_data][display_name]', 'Free US shipping');
  p.set('shipping_options[0][shipping_rate_data][delivery_estimate][minimum][unit]', 'business_day');
  p.set('shipping_options[0][shipping_rate_data][delivery_estimate][minimum][value]', '4');
  p.set('shipping_options[0][shipping_rate_data][delivery_estimate][maximum][unit]', 'business_day');
  p.set('shipping_options[0][shipping_rate_data][delivery_estimate][maximum][value]', '10');
  p.set(
    'custom_text[submit][message]',
    PREORDER
      ? `Pre-order at the founding price: $${each} a roll${saving > 0 ? `, so you save $${saving} on the launch price` : ''}. ` +
          `We charge you today and your order ships free by ${SHIP_BY}. Change your mind any time before it ships ` +
          'and email hello@bluehournights.com for a full refund.'
      : (saving > 0 ? `${tier.name} price: $${each} a roll, so you save $${saving}. ` : '') +
          'Every roll is packed to order and ships free within the US.'
  );

  const summary = [];
  lines.forEach((l, i) => {
    const kind = isSignature(l.mix) ? 'Signature pouch' : 'Custom pouch';
    const pack = packList(l.mix);
    p.set(`line_items[${i}][quantity]`, String(l.qty));
    p.set(`line_items[${i}][price_data][currency]`, 'usd');
    p.set(`line_items[${i}][price_data][unit_amount]`, String(each * 100));
    p.set(`line_items[${i}][price_data][product_data][name]`, PREORDER ? `Blue Hour, 30-night roll (pre-order, ships by ${SHIP_BY})` : 'Blue Hour, 30-night roll');
    p.set(`line_items[${i}][price_data][product_data][description]`, `${kind}: ${pack}`);
    p.set(`line_items[${i}][price_data][product_data][images][0]`, `${origin}/images/checkout-box.jpg`);
    const line = `${l.qty} roll${l.qty > 1 ? 's' : ''}: ${pack}`.slice(0, 500);
    p.set(`metadata[pouch_${i + 1}]`, line);
    p.set(`payment_intent_data[metadata][pouch_${i + 1}]`, line);
    summary.push(`${kind} x${l.qty}`);
  });
  p.set('metadata[rolls]', String(rolls));
  p.set('metadata[price_each]', String(each));
  if (PREORDER) {
    p.set('metadata[preorder]', 'yes');
    p.set('metadata[ship_by]', SHIP_BY);
    p.set('payment_intent_data[metadata][preorder]', 'yes');
    p.set('payment_intent_data[metadata][ship_by]', SHIP_BY);
  }
  p.set('payment_intent_data[description]', `Blue Hour${PREORDER ? ' pre-order' : ''}: ${summary.join(', ')}`);
  return p;
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (e) { return {}; }
  }
  return {};
}

async function createSession(key, params) {
  const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  const data = await r.json();
  return { ok: r.ok && !!data.url, data, status: r.status };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return res.status(503).json({ error: 'not_configured' });

  const body = readBody(req);
  const lines = cleanLines(body.lines);
  if (!lines.length) return res.status(400).json({ error: 'empty_cart' });

  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const origin = `${proto}://${host}`;

  try {
    // One discount per order: whichever saves the shopper the most out of their code (from a link or the
    // welcome offer) and the best easter egg they've found. Crew pricing isn't a discount and always applies.
    // If Stripe turns a discount down (expired, first orders only...), try the next one, then none, so the
    // shopper still gets to checkout and can type a code there.
    const rolls = lines.reduce((a, l) => a + l.qty, 0);
    const subtotal = totalFor(rolls) * 100;
    const options = [];
    // During pre-order no code or egg applies: the founding price is the deal.
    const promo = !PREORDER && body.code ? await findPromo(body.code, key).catch(() => null) : null;
    if (promo) options.push({ value: promoValue(promo, subtotal), disc: { promo: promo.id } });
    const egg = PREORDER ? null : readEgg(body.egg);
    if (egg) {
      const coupon = await eggCoupon(egg, key).catch(() => null);
      if (coupon) options.push({ value: Math.min(egg.amount * 100, subtotal), disc: { coupon } });
    }
    const tries = options.filter((o) => o.value > 0).sort((a, b) => b.value - a.value);
    tries.push({ value: 0, disc: null });

    let out;
    for (const o of tries) {
      out = await createSession(key, sessionParams(lines, origin, o.disc));
      if (out.ok) break;
    }
    if (!out.ok) {
      console.error('Stripe Checkout error:', out.data && out.data.error ? out.data.error.message : out.status);
      return res.status(502).json({ error: 'stripe_error' });
    }
    return res.status(200).json({ url: out.data.url });
  } catch (e) {
    console.error('Stripe request failed:', e);
    return res.status(502).json({ error: 'stripe_unreachable' });
  }
}
