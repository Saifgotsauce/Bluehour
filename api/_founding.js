// The founding offer counter (docs/FUNNEL.md section 1).
// Counts real paid founding orders in Stripe: payments that succeeded, were made at the founding price
// (metadata preorder=yes or founding=yes) and haven't been fully refunded. Nothing here is ever invented,
// so the number on the site is always the true one.
import { FOUNDING_CAP } from '../src/data/preorder.js';

let cache = { at: 0, ids: null };

async function stripeGet(key, path) {
  const r = await fetch('https://api.stripe.com/v1/' + path, { headers: { Authorization: `Bearer ${key}` } });
  const d = await r.json();
  if (!r.ok) throw new Error((d && d.error && d.error.message) || 'stripe ' + r.status);
  return d;
}

// Paid founding payment intents, oldest first. Cached for 60 seconds per server instance.
export async function foundingOrders(key, fresh) {
  if (!fresh && cache.ids && Date.now() - cache.at < 60e3) return cache.ids;
  const q = encodeURIComponent("status:'succeeded' AND (metadata['preorder']:'yes' OR metadata['founding']:'yes')");
  let page = null, all = [];
  for (let i = 0; i < 10; i++) {
    const d = await stripeGet(key, `payment_intents/search?query=${q}&limit=100&expand[]=data.latest_charge${page ? '&page=' + encodeURIComponent(page) : ''}`);
    all = all.concat(d.data || []);
    if (!d.has_more) break;
    page = d.next_page;
  }
  const ids = all
    .filter((pi) => !(pi.latest_charge && typeof pi.latest_charge === 'object' && pi.latest_charge.refunded))
    .sort((a, b) => a.created - b.created)
    .map((pi) => pi.id);
  cache = { at: Date.now(), ids };
  return ids;
}

export async function foundingCount(key, fresh) {
  return (await foundingOrders(key, fresh)).length;
}

// The founding member number (1 to FOUNDING_CAP) for a Checkout session, or null.
export async function foundingNumber(key, sessionId) {
  const s = await stripeGet(key, `checkout/sessions/${encodeURIComponent(sessionId)}`);
  if (!s.payment_intent) return null;
  const ids = await foundingOrders(key, true);
  const i = ids.indexOf(s.payment_intent);
  return i >= 0 && i < FOUNDING_CAP ? i + 1 : null;
}
