// POST /api/checkout
// Turns the cart into a Stripe Checkout page. Prices and pouch limits are re-checked here, so the
// browser can't change what an order costs or what goes into a pouch.
// Needs STRIPE_SECRET_KEY in Vercel (Settings > Environment Variables). Use the sk_test_ key first.

import { PRICE, INGREDIENTS, cleanMix, mixTotal, isSignature } from '../src/data/ingredients.js';

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

export function sessionParams(lines, origin) {
  const p = new URLSearchParams();
  p.set('mode', 'payment');
  p.set('success_url', `${origin}/thank-you?session_id={CHECKOUT_SESSION_ID}`);
  p.set('cancel_url', `${origin}/shop`);
  p.set('shipping_address_collection[allowed_countries][0]', 'US');
  p.set('allow_promotion_codes', 'true');
  p.set('shipping_options[0][shipping_rate_data][type]', 'fixed_amount');
  p.set('shipping_options[0][shipping_rate_data][fixed_amount][amount]', '0');
  p.set('shipping_options[0][shipping_rate_data][fixed_amount][currency]', 'usd');
  p.set('shipping_options[0][shipping_rate_data][display_name]', 'Free US shipping');
  p.set('shipping_options[0][shipping_rate_data][delivery_estimate][minimum][unit]', 'business_day');
  p.set('shipping_options[0][shipping_rate_data][delivery_estimate][minimum][value]', '4');
  p.set('shipping_options[0][shipping_rate_data][delivery_estimate][maximum][unit]', 'business_day');
  p.set('shipping_options[0][shipping_rate_data][delivery_estimate][maximum][value]', '10');
  p.set('custom_text[submit][message]', 'Every roll is packed to order and ships free within the US.');

  const summary = [];
  lines.forEach((l, i) => {
    const kind = isSignature(l.mix) ? 'Signature pouch' : 'Custom pouch';
    const pack = packList(l.mix);
    p.set(`line_items[${i}][quantity]`, String(l.qty));
    p.set(`line_items[${i}][price_data][currency]`, 'usd');
    p.set(`line_items[${i}][price_data][unit_amount]`, String(PRICE * 100));
    p.set(`line_items[${i}][price_data][product_data][name]`, 'Blue Hour, 30-night roll');
    p.set(`line_items[${i}][price_data][product_data][description]`, `${kind}: ${pack}`);
    p.set(`line_items[${i}][price_data][product_data][images][0]`, `${origin}/images/checkout-roll.jpg`);
    const line = `${l.qty} roll${l.qty > 1 ? 's' : ''}: ${pack}`.slice(0, 500);
    p.set(`metadata[pouch_${i + 1}]`, line);
    p.set(`payment_intent_data[metadata][pouch_${i + 1}]`, line);
    summary.push(`${kind} x${l.qty}`);
  });
  p.set('payment_intent_data[description]', `Blue Hour: ${summary.join(', ')}`);
  return p;
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (e) { return {}; }
  }
  return {};
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return res.status(503).json({ error: 'not_configured' });

  const lines = cleanLines(readBody(req).lines);
  if (!lines.length) return res.status(400).json({ error: 'empty_cart' });

  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const origin = `${proto}://${host}`;

  try {
    const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: sessionParams(lines, origin),
    });
    const data = await r.json();
    if (!r.ok || !data.url) {
      console.error('Stripe Checkout error:', data && data.error ? data.error.message : r.status);
      return res.status(502).json({ error: 'stripe_error' });
    }
    return res.status(200).json({ url: data.url });
  } catch (e) {
    console.error('Stripe request failed:', e);
    return res.status(502).json({ error: 'stripe_unreachable' });
  }
}
