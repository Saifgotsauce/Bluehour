// GET /api/founding                  -> { cap, claimed, left, show }
// GET /api/founding?session_id=cs_…  -> also { number }: this order's founding member number
// "show" is false until enough real orders exist to be worth showing (FOUNDING_SHOW_FROM). Before that the site
// just says "founding price for the first 100 orders", with no count.
import { FOUNDING_CAP } from '../src/data/preorder.js';
import { foundingCount, foundingNumber } from './_founding.js';

export const FOUNDING_SHOW_FROM = 10;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return res.status(503).json({ error: 'not_configured' });
  const sid = typeof req.query.session_id === 'string' && /^cs_[\w]{10,200}$/.test(req.query.session_id) ? req.query.session_id : '';
  try {
    const claimed = Math.min(FOUNDING_CAP, await foundingCount(key, !!sid));
    const out = { cap: FOUNDING_CAP, claimed, left: FOUNDING_CAP - claimed, show: claimed >= FOUNDING_SHOW_FROM };
    if (sid) {
      out.number = await foundingNumber(key, sid).catch(() => null);
      res.setHeader('Cache-Control', 'no-store');
    } else {
      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
    }
    return res.status(200).json(out);
  } catch (e) {
    console.error('Founding count failed:', e && e.message);
    return res.status(502).json({ error: 'stripe_error' });
  }
}
