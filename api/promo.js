// GET /api/promo?code=RAVE15
// Tells the site whether a discount code from a link is live, and what it's worth, so the site can
// show "RAVE15: 15% off, applied at checkout". The code itself is applied by /api/checkout.

import { cleanCode, findPromo, queryParam } from './_promo.js';
import { findCrew } from './_crew.js';
import { PREORDER } from '../src/data/preorder.js';
import { CREW_OFF } from '../src/data/crew.js';
import { isFollowerCode, FOLLOWER_CODE, FOLLOWER_OFF } from '../src/data/offers.js';
import { followerCoupon } from './_offers.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ valid: false });
  }
  const key = process.env.STRIPE_SECRET_KEY;
  const code = cleanCode(queryParam(req, 'code'));
  if (!key || !code) return res.status(200).json({ valid: false });
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  // Founding Crew codes work any time, including pre-order. Other codes are paused during pre-order.
  const crew = await findCrew(code, key).catch(() => null);
  if (crew) return res.status(200).json({ valid: true, crew: true, code: crew.code, label: `$${CREW_OFF} off each roll from ${crew.name || 'the Founding Crew'}` });
  // The followers' code works during pre-order too, while its uses last.
  if (isFollowerCode(code)) {
    const live = await followerCoupon(key).catch(() => null);
    return res.status(200).json(live ? { valid: true, code: FOLLOWER_CODE, label: `$${FOLLOWER_OFF} off your order, for our first followers` } : { valid: false });
  }
  const promo = PREORDER ? null : await findPromo(code, key).catch(() => null);
  if (!promo) return res.status(200).json({ valid: false });
  return res.status(200).json({ valid: true, code: promo.code, label: promo.label });
}
