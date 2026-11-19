// POST /api/trybe-order  { session_id }
// Called from the thank-you page. Looks the order up in Stripe (so nothing the browser sends is trusted),
// and if it's paid and came with a Trybe visitor ID, reports it to Trybe so the creator who sent the
// shopper gets the credit. Each order is reported once: the payment is marked trybe_sent afterwards.
// Needs TRYBE_API_KEY and STRIPE_SECRET_KEY in Vercel. The Trybe key is private: never use it in the browser.

const TRYBE_URL = 'https://jointrybe.com/attribution/v1/orders';

function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (e) { return {}; }
  }
  return {};
}

async function stripe(key, path, form) {
  const r = await fetch('https://api.stripe.com/v1/' + path, {
    method: form ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${key}`, ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
    body: form || undefined,
  });
  return { ok: r.ok, data: await r.json().catch(() => ({})) };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  const skey = process.env.STRIPE_SECRET_KEY;
  const tkey = process.env.TRYBE_API_KEY;
  if (!skey || !tkey) return res.status(503).json({ error: 'not_configured' });

  const id = readBody(req).session_id;
  if (typeof id !== 'string' || !/^cs_[A-Za-z0-9_]{10,250}$/.test(id)) return res.status(400).json({ error: 'bad_session' });

  try {
    const s = await stripe(skey, `checkout/sessions/${id}?expand[]=payment_intent`);
    if (!s.ok) return res.status(404).json({ error: 'not_found' });
    const session = s.data;
    const pi = session.payment_intent;
    const vid = (session.metadata && session.metadata.trybe_vid) || '';
    if (session.payment_status !== 'paid' || !pi || typeof pi !== 'object') return res.status(200).json({ sent: false, reason: 'unpaid' });
    if (!vid) return res.status(200).json({ sent: false, reason: 'no_vid' });
    if (pi.metadata && pi.metadata.trybe_sent) return res.status(200).json({ sent: false, reason: 'already_sent' });

    const rolls = parseInt(session.metadata.rolls, 10) || 1;
    const order = {
      apiKey: tkey,
      orderId: session.id,
      value: (session.amount_total || 0) / 100,
      currency: (session.currency || 'usd').toUpperCase(),
      vid,
      email: (session.customer_details && session.customer_details.email) || undefined,
      orderTime: new Date((session.created || Date.now() / 1000) * 1000).toISOString(),
      items: [{ id: 'blue-hour-roll-30', quantity: rolls, item_price: ((session.amount_total || 0) / 100) / rolls }],
    };
    const t = await fetch(TRYBE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tkey}` },
      body: JSON.stringify(order),
    });
    if (!t.ok) {
      console.error('Trybe order error:', t.status, (await t.text().catch(() => '')).slice(0, 300));
      return res.status(502).json({ error: 'trybe_error' });
    }
    await stripe(skey, `payment_intents/${pi.id}`, new URLSearchParams({ 'metadata[trybe_sent]': new Date().toISOString() }));
    return res.status(200).json({ sent: true });
  } catch (e) {
    console.error('Trybe order failed:', e);
    return res.status(502).json({ error: 'unreachable' });
  }
}
