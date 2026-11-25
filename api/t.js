// POST /api/t
// Blue Hour's own anonymous event log (src/scripts/track.js sends here).
// Each event is written as one JSON line to the Vercel function logs (type "bh_event"), so it can be searched in
// Vercel now and shipped anywhere later with a Vercel log drain.
// Optional: set EVENTS_WEBHOOK_URL in Vercel to also forward every batch to a database or warehouse endpoint.
// No personal details reach this endpoint: the browser only sends allow-listed, anonymous parameters,
// and this function re-checks the names against the same list, and the sizes. IP addresses are not logged here.

const NAME = /^[a-z][a-z0-9_]{1,39}$/;
// Same allow-list as src/scripts/track.js. Anything else is dropped, even if someone posts it here directly.
const ALLOWED = new Set([
  'page_type', 'section', 'cta', 'rolls', 'value', 'kind', 'count', 'action', 'topic', 'report',
  'state', 'from', 'error', 'step', 'tx', 'form', 'crew', 'seconds', 'source', 'qty',
]);
const ID = /^[\w-]{6,40}$/;

function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (e) { return {}; } }
  return {};
}

export function cleanBatch(body) {
  const aid = typeof body.aid === 'string' && ID.test(body.aid) ? body.aid : '';
  const sid = typeof body.sid === 'string' && ID.test(body.sid) ? body.sid : '';
  if (!aid || !sid || !Array.isArray(body.events)) return null;
  const now = Date.now();
  const events = body.events.slice(0, 40).map((e) => {
    if (!e || typeof e.n !== 'string' || !NAME.test(e.n)) return null;
    const p = {};
    if (e.p && typeof e.p === 'object') {
      Object.keys(e.p).slice(0, 12).forEach((k) => {
        const v = e.p[k];
        if (!ALLOWED.has(k)) return;
        if (typeof v === 'number' && isFinite(v)) p[k] = v;
        else if (typeof v === 'boolean') p[k] = v;
        else if (typeof v === 'string') p[k] = v.replace(/[^\w.\-:/ |=,@]/g, '').slice(0, 80);
      });
    }
    const t = typeof e.t === 'number' && Math.abs(now - e.t) < 864e5 ? e.t : now;
    const path = typeof e.path === 'string' ? e.path.replace(/[^\w./-]/g, '').slice(0, 80) : '';
    return { name: e.n, params: p, ts: new Date(t).toISOString(), path };
  }).filter(Boolean);
  return events.length ? { aid, sid, events } : null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  const batch = cleanBatch(readBody(req));
  if (!batch) return res.status(204).end();
  const country = req.headers['x-vercel-ip-country'] || '';
  for (const e of batch.events) {
    console.log(JSON.stringify({ type: 'bh_event', aid: batch.aid, sid: batch.sid, country, ...e }));
  }
  const hook = process.env.EVENTS_WEBHOOK_URL;
  if (hook) {
    try {
      await fetch(hook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...batch, country }) });
    } catch (e) { console.error('EVENTS_WEBHOOK_URL failed:', e && e.message); }
  }
  return res.status(204).end();
}
