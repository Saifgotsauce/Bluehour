// GET /api/promo?code=RAVE15
// Tells the site whether a discount code from a link is live, and what it's worth, so the site can
// show "RAVE15: 15% off, applied at checkout". The code itself is applied by /api/checkout.

import { cleanCode, findPromo, queryParam } from './_promo.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ valid: false });
  }
  const key = process.env.STRIPE_SECRET_KEY;
  const code = cleanCode(queryParam(req, 'code'));
  if (!key || !code) return res.status(200).json({ valid: false });
  const promo = await findPromo(code, key).catch(() => null);
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  if (!promo) return res.status(200).json({ valid: false });
  return res.status(200).json({ valid: true, code: promo.code, label: promo.label });
}
