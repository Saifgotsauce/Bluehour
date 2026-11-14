// POST /api/egg { egg, offset, have }
// Called when a shopper finds a hidden egg. Returns a signed token worth that egg's discount for 48 hours.
//   offset: the shopper's timezone, in minutes ahead of UTC (for the blue hour egg).
//   have:   tokens they already hold (for the collector egg).

import { eggById, eggAmount, inBlueHour, COLLECTOR_NEEDS } from '../src/data/eggs.js';
import { signEgg, readEgg } from './_eggs.js';
import { PREORDER } from '../src/data/preorder.js';

function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (e) { return {}; }
  }
  return {};
}

export function localHour(offsetMinutes, now = Date.now()) {
  const off = Math.max(-840, Math.min(840, parseInt(offsetMinutes, 10) || 0));
  return new Date(now + off * 60000).getUTCHours();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  if (!process.env.STRIPE_SECRET_KEY) return res.status(503).json({ error: 'not_configured' });
  const body = readBody(req);
  // Eggs are switched off during pre-order (see src/data/preorder.js).
  if (PREORDER) return res.status(403).json({ error: 'eggs_off' });
  const egg = eggById(String(body.egg || ''));
  if (!egg) return res.status(400).json({ error: 'unknown_egg' });

  if (egg.id === 'bluehour' && !inBlueHour(localHour(body.offset))) {
    return res.status(403).json({ error: 'not_blue_hour' });
  }
  if (egg.id === 'collector') {
    const have = Array.isArray(body.have) ? body.have.slice(0, 10) : [];
    const ids = new Set(have.map((t) => readEgg(t)).filter((e) => e && e.id !== 'collector').map((e) => e.id));
    if (ids.size < COLLECTOR_NEEDS) return res.status(403).json({ error: 'need_more_eggs' });
  }

  const token = signEgg(egg.id);
  return res.status(200).json({ token, id: egg.id, name: egg.name, rarity: egg.rarity, amount: eggAmount(egg.id), found: egg.found, expires: readEgg(token).expires });
}
