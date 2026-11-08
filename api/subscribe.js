// /api/subscribe
// GET  -> { on: true } once email sign-ups are connected, so the site only shows the welcome offer when it works.
// POST { email, when, source } -> adds the email to the Klaviyo list with marketing consent, saves when their
//      next big night is, and returns the welcome code.
// Needs in Vercel: KLAVIYO_PRIVATE_KEY, KLAVIYO_LIST_ID. Optional: WELCOME_CODE (default WELC10).

import { findPromo } from './_promo.js';

const KLAVIYO_REVISION = '2024-10-15';
const WHEN = { 'this-weekend': 'This weekend', 'this-month': 'This month', later: 'Later this year', 'every-weekend': 'Every weekend' };
const SOURCES = { popup: 'Blue Hour website popup', footer: 'Blue Hour website footer' };

export const cleanEmail = (e) => {
  const s = String(e == null ? '' : e).trim().toLowerCase();
  return s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) ? s : '';
};

function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (e) { return {}; }
  }
  return {};
}

const klaviyo = (path, key, body) =>
  fetch('https://a.klaviyo.com/api/' + path, {
    method: 'POST',
    headers: {
      Authorization: `Klaviyo-API-Key ${key}`,
      accept: 'application/json',
      'content-type': 'application/json',
      revision: KLAVIYO_REVISION,
    },
    body: JSON.stringify(body),
  });

export function profileBody(email, when, source) {
  const properties = { signup_source: source };
  if (when) properties.next_big_night = WHEN[when];
  return { data: { type: 'profile', attributes: { email, properties } } };
}

export function subscribeBody(email, list, source) {
  return {
    data: {
      type: 'profile-subscription-bulk-create-job',
      attributes: {
        custom_source: SOURCES[source],
        profiles: { data: [{ type: 'profile', attributes: { email, subscriptions: { email: { marketing: { consent: 'SUBSCRIBED' } } } } }] },
      },
      relationships: { list: { data: { type: 'list', id: list } } },
    },
  };
}

export default async function handler(req, res) {
  const key = process.env.KLAVIYO_PRIVATE_KEY;
  const list = process.env.KLAVIYO_LIST_ID;
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'public, s-maxage=60');
    return res.status(200).json({ on: !!(key && list) });
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  if (!key || !list) return res.status(503).json({ error: 'not_configured' });

  const body = readBody(req);
  const email = cleanEmail(body.email);
  if (!email) return res.status(400).json({ error: 'bad_email' });
  const when = Object.prototype.hasOwnProperty.call(WHEN, body.when) ? body.when : '';
  const source = Object.prototype.hasOwnProperty.call(SOURCES, body.source) ? body.source : 'footer';

  try {
    // Save the extra details first (not essential), then the subscription (essential).
    await klaviyo('profile-import/', key, profileBody(email, when, source)).catch(() => null);
    const r = await klaviyo('profile-subscription-bulk-create-jobs/', key, subscribeBody(email, list, source));
    if (!r.ok) {
      console.error('Klaviyo subscribe failed:', r.status, await r.text().catch(() => ''));
      return res.status(502).json({ error: 'email_error' });
    }
  } catch (e) {
    console.error('Klaviyo request failed:', e);
    return res.status(502).json({ error: 'email_unreachable' });
  }

  // The welcome code only comes with the pop-up offer (not the footer sign-up), and only if it's live in Stripe.
  const promo = source !== 'popup' ? null : await findPromo(process.env.WELCOME_CODE || 'WELC10', process.env.STRIPE_SECRET_KEY).catch(() => null);
  return res.status(200).json(promo ? { ok: true, code: promo.code, label: promo.label } : { ok: true });
}
