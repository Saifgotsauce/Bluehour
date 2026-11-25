// GET /api/founding: how many founding-price orders are left, for the counter on the shop page.
import { foundingLeft } from './_offers.js';
import { FOUNDING_LIMIT } from '../src/data/offers.js';
import { PREORDER } from '../src/data/preorder.js';

export default async function handler(req, res) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || !PREORDER) return res.status(200).json({ limit: FOUNDING_LIMIT, left: null });
  res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=300');
  try {
    return res.status(200).json({ limit: FOUNDING_LIMIT, left: await foundingLeft(key) });
  } catch (e) {
    console.error('Founding count failed:', e);
    return res.status(200).json({ limit: FOUNDING_LIMIT, left: null });
  }
}
