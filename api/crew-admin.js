// /api/crew-admin?key=YOUR_KEY
// The Founding Crew back office, for your phone. Only works with the CREW_ADMIN_KEY set in Vercel.
// - See every ambassador: what they've earned, what's held, what you owe, and every order with the reason it
//   counted or didn't.
// - Approve someone (makes their code in Stripe), pause or restart a code, record a PayPal payout,
//   and mark their free roll as sent.

import crypto from 'node:crypto';
import { stripe, ensureCrewCoupon, CREW_COUPON, listCrew, listCrewOrders, ledger, normAddress, dashPath } from './_crew.js';
import { cleanCrewCode, CREW_OFF } from '../src/data/crew.js';
import { cleanEmail } from './subscribe.js';
import { SHIP_BY_FULL } from '../src/data/preorder.js';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const usd = (cents) => (cents < 0 ? '-' : '') + '$' + (Math.abs(cents) / 100).toFixed(2);
const day = (t) => new Date(t).toISOString().slice(0, 10);

function keyOk(given) {
  const want = process.env.CREW_ADMIN_KEY || '';
  const g = String(given || '');
  if (want.length < 16 || g.length !== want.length) return false;
  return crypto.timingSafeEqual(Buffer.from(g), Buffer.from(want));
}

function readForm(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return Object.fromEntries(new URLSearchParams(req.body));
  return {};
}

async function act(key, f, origin) {
  const code = cleanCrewCode(f.code);
  if (f.action === 'approve') {
    const email = cleanEmail(f.email);
    if (!code || !email || !String(f.name || '').trim()) return 'Approve needs a code, a name and an email.';
    if (!(await ensureCrewCoupon(key))) return 'Could not set up the crew coupon in Stripe.';
    const meta = {
      'metadata[crew]': '1', 'metadata[name]': String(f.name).trim().slice(0, 80), 'metadata[email]': email,
      'metadata[ship]': normAddress({ line1: f.line1, postal_code: f.zip }), 'metadata[paypal]': String(f.paypal || email).trim().slice(0, 120),
      'metadata[paid]': '0',
    };
    let r = await stripe(key, 'promotion_codes', { method: 'POST', params: new URLSearchParams({ 'promotion[type]': 'coupon', 'promotion[coupon]': CREW_COUPON, code, ...meta }) });
    if (!r.ok && r.d.error && /promotion/.test(r.d.error.message || '')) {
      r = await stripe(key, 'promotion_codes', { method: 'POST', params: new URLSearchParams({ coupon: CREW_COUPON, code, ...meta }) });
    }
    return r.ok ? `${code} is live. Send them their dashboard: ${origin}${dashPath(code)}` : 'Stripe said: ' + (r.d.error ? r.d.error.message : r.status);
  }
  const id = String(f.id || '');
  if (!/^promo_[A-Za-z0-9]+$/.test(id)) return 'Unknown ambassador.';
  if (f.action === 'pause' || f.action === 'resume') {
    const r = await stripe(key, 'promotion_codes/' + id, { method: 'POST', params: new URLSearchParams({ active: f.action === 'resume' ? 'true' : 'false' }) });
    return r.ok ? (f.action === 'pause' ? 'Code paused. It stops working at checkout right away.' : 'Code is live again.') : 'Stripe said: ' + (r.d.error ? r.d.error.message : r.status);
  }
  if (f.action === 'paid') {
    const cents = Math.round(parseFloat(f.amount) * 100);
    if (!(cents > 0)) return 'Enter the amount you sent.';
    const cur = await stripe(key, 'promotion_codes/' + id);
    if (!cur.ok) return 'Could not read that code from Stripe.';
    const before = parseInt((cur.d.metadata || {}).paid, 10) || 0;
    const r = await stripe(key, 'promotion_codes/' + id, { method: 'POST', params: new URLSearchParams({ 'metadata[paid]': String(before + cents) }) });
    return r.ok ? `Recorded ${usd(cents)} paid.` : 'Stripe said: ' + (r.d.error ? r.d.error.message : r.status);
  }
  if (f.action === 'freeroll') {
    const r = await stripe(key, 'promotion_codes/' + id, { method: 'POST', params: new URLSearchParams({ 'metadata[free_roll]': 'sent' }) });
    return r.ok ? 'Free roll marked as sent.' : 'Stripe said: ' + (r.d.error ? r.d.error.message : r.status);
  }
  return 'Unknown action.';
}

function page(adminKey, rows, note, origin) {
  const k = `<input type="hidden" name="key" value="${esc(adminKey)}">`;
  const owedTotal = rows.reduce((a, c) => a + Math.max(0, c.owedCents), 0);
  const people = rows.sort((a, b) => b.owedCents - a.owedCents).map((c) => `
    <section class="p">
      <div class="ph"><h2>${esc(c.code)}</h2><span class="${c.active ? 'on' : 'off'}">${c.active ? 'Live' : 'Paused'}</span></div>
      <p class="who">${esc(c.name)} · ${esc(c.email)} · PayPal ${esc(c.paypal)}</p>
      <div class="dash"><span>${esc(origin + dashPath(c.code))}</span><button type="button" class="ghost" data-copy="${esc(origin + dashPath(c.code))}">Copy dashboard link</button></div>
      <div class="nums">
        <div><b>${usd(Math.max(0, c.owedCents))}</b><small>Owed now</small></div>
        <div><b>${usd(c.heldCents)}</b><small>Held</small></div>
        <div><b>${c.earnedRolls}</b><small>Rolls counted</small></div>
        <div><b>${usd(c.paidCents)}</b><small>Paid so far</small></div>
      </div>
      ${c.owedCents < 0 ? `<p class="warn">${usd(-c.owedCents)} comes off their next payout (a paid order was refunded or disputed).</p>` : ''}
      <p class="fr">Free roll: <b>${esc(c.freeRoll)}</b></p>
      <div class="acts">
        ${c.owedCents > 0 ? `<form method="post">${k}<input type="hidden" name="action" value="paid"><input type="hidden" name="id" value="${esc(c.id)}"><input name="amount" inputmode="decimal" value="${(c.owedCents / 100).toFixed(2)}"><button>Mark paid</button></form>` : ''}
        ${c.freeRoll === 'due' ? `<form method="post">${k}<input type="hidden" name="action" value="freeroll"><input type="hidden" name="id" value="${esc(c.id)}"><button>Free roll sent</button></form>` : ''}
        <form method="post">${k}<input type="hidden" name="action" value="${c.active ? 'pause' : 'resume'}"><input type="hidden" name="id" value="${esc(c.id)}"><button class="ghost">${c.active ? 'Pause code' : 'Restart code'}</button></form>
      </div>
      ${c.orders.length ? `<details><summary>${c.orders.length} order${c.orders.length > 1 ? 's' : ''}</summary><table>
        <tr><th>Date</th><th>Rolls</th><th>Paid</th><th>Commission</th><th>Status</th></tr>
        ${c.orders.slice().reverse().map((o) => `<tr class="${o.status}"><td>${day(o.at)}</td><td>${o.rolls}</td><td>${usd(o.paidCents)}</td><td>${o.status === 'void' ? '-' : usd(o.commissionCents)}</td><td>${esc(o.status)}${o.why ? `<small>${esc(o.why)}</small>` : ''}</td></tr>`).join('')}
      </table></details>` : '<p class="fine">No orders with this code yet.</p>'}
    </section>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Founding Crew admin</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;800&display=swap">
<style>
*{box-sizing:border-box}body{margin:0;font:400 15px/1.45 Poppins,Arial,sans-serif;color:#141A3C;background:#F2F8FF}
header{background:linear-gradient(180deg,#0B1F9E,#1436D8);color:#fff;padding:22px 18px 26px}h1{margin:0;font-weight:800;font-size:28px;letter-spacing:-.03em}
header p{margin:6px 0 0;opacity:.9}main{padding:16px;max-width:760px;margin:auto;display:grid;gap:14px}
.note{background:#fff;border:2px solid #1436D8;border-radius:14px;padding:12px 14px;font-weight:600}
.p{background:#fff;border-radius:18px;padding:16px;box-shadow:0 6px 18px rgba(11,31,158,.08)}
.ph{display:flex;justify-content:space-between;align-items:center}h2{margin:0;font-weight:800;font-size:24px;letter-spacing:.02em;color:#1436D8}
.on,.off{font:600 12px Poppins;padding:4px 10px;border-radius:99px;background:#D7F0FF}.off{background:#FFE1E6;color:#A0122D}
.who{margin:4px 0 12px;color:#4B5272;font-size:13px;word-break:break-word}
.nums{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.nums div{background:#F2F8FF;border-radius:12px;padding:10px 8px}
.nums b{display:block;font-weight:800;font-size:17px}.nums small{color:#4B5272;font-size:11.5px}
.warn{color:#A0122D;font-weight:600}.fr{margin:10px 0}
.acts{display:flex;flex-wrap:wrap;gap:8px}.acts form{display:flex;gap:6px}
input,button{font:inherit}input{border:2px solid #141A3C;border-radius:10px;padding:8px 10px;width:100%}
.acts input{width:110px}button{border:2px solid #141A3C;background:#141A3C;color:#fff;border-radius:10px;padding:8px 14px;font-weight:600;cursor:pointer}
button.ghost{background:#fff;color:#141A3C}
details{margin-top:12px}summary{cursor:pointer;font-weight:600}table{width:100%;border-collapse:collapse;margin-top:8px;font-size:13px}
th,td{text-align:left;padding:6px 4px;border-bottom:1px solid #D9E2F2;vertical-align:top}td small{display:block;color:#4B5272}
tr.void td{color:#8A90AD}tr.held td:last-child{color:#1436D8}tr.earned td:last-child{color:#0B7A3B;font-weight:600}
.dash{display:flex;gap:8px;align-items:center;background:#F2F8FF;border-radius:12px;padding:6px 6px 6px 12px;margin:0 0 12px}.dash span{flex:1;min-width:0;font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#4B5272}.dash button{padding:6px 10px;font-size:13px;flex:none}
.approve{display:grid;gap:8px}.approve .two{display:grid;grid-template-columns:1fr 1fr;gap:8px}.fine{color:#4B5272;font-size:13px}
</style></head><body>
<header><h1>Founding Crew</h1><p>${rows.length} ambassador${rows.length === 1 ? '' : 's'} · ${usd(owedTotal)} to pay out</p></header>
<main>
${note ? `<p class="note">${esc(note)}</p>` : ''}
${people || '<p class="fine">No ambassadors yet. Approve your first one below.</p>'}
<section class="p"><h2>Approve someone</h2>
<p class="fine">Copy their details from Klaviyo. Their home address is only used to stop them earning on their own orders.</p>
<form method="post" class="approve">${k}<input type="hidden" name="action" value="approve">
<input name="code" placeholder="Code, like MAYA5" autocapitalize="characters" required>
<div class="two"><input name="name" placeholder="Full name" required><input name="email" type="email" placeholder="Email" required></div>
<div class="two"><input name="line1" placeholder="Street address"><input name="zip" placeholder="ZIP code"></div>
<input name="paypal" placeholder="PayPal email (if different)">
<button>Approve and make their code</button></form>
<p class="fine">Their friends get $${CREW_OFF} off each roll with the code. Codes work right away; commission shows here as held until it can be paid.</p>
</section>
</main>
<script>document.querySelectorAll('[data-copy]').forEach(function(b){b.addEventListener('click',function(){var t=b.getAttribute('data-copy');function d(){var o=b.textContent;b.textContent='Copied';setTimeout(function(){b.textContent=o},1500)}navigator.clipboard&&navigator.clipboard.writeText?navigator.clipboard.writeText(t).then(d,function(){prompt('Copy',t)}):prompt('Copy',t)})})</script>
</body></html>`;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  const form = req.method === 'POST' ? readForm(req) : {};
  const adminKey = req.method === 'POST' ? form.key : req.query && req.query.key;
  if (!keyOk(adminKey)) return res.status(404).send('Not found');
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return res.status(503).send('Stripe is not connected.');

  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  const origin = `${proto}://${req.headers['x-forwarded-host'] || req.headers.host}`;
  if (req.method === 'POST') {
    const note = await act(key, form, origin).catch((e) => 'Something went wrong: ' + e.message);
    res.setHeader('Location', `/api/crew-admin?key=${encodeURIComponent(adminKey)}&note=${encodeURIComponent(note)}`);
    return res.status(303).end();
  }
  try {
    const [crews, orders] = await Promise.all([listCrew(key), listCrewOrders(key)]);
    const rows = ledger(crews, orders, { shipByFull: SHIP_BY_FULL });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(page(adminKey, rows, req.query.note ? String(req.query.note).slice(0, 300) : '', origin));
  } catch (e) {
    console.error('Crew admin failed:', e);
    return res.status(502).send("Couldn't load from Stripe. Try again in a minute.");
  }
}
