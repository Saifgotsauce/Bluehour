// /me?c=CODE&t=TOKEN  (rewritten here from /me in vercel.json)
// An ambassador's own Founding Crew dashboard. The link is private to them: the token is signed (see dashToken in
// _crew.js), and you get it from the admin page once you've approved them.
// Every visit reads Stripe fresh, so a sale shows up the moment the order is paid. It only ever shows their own
// sales, and never who bought: just the date, the rolls and what they earned.

import { listCrew, listCrewOrders, ledger, dashOk } from './_crew.js';
import { CREW_OFF, CREW_RATE, BOOST_AT, BOOST_RATE, FREE_ROLL_AT, HOLD_AFTER_SHIP_DAYS, HOLD_DAYS, REPEAT_DAYS, cleanCrewCode } from '../src/data/crew.js';
import { SHIP_BY, SHIP_BY_FULL, PREORDER } from '../src/data/preorder.js';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const usd = (cents) => '$' + (cents % 100 ? (cents / 100).toFixed(2) : String(cents / 100));
const when = (t) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles' });

// Plain-language status for each sale. Never says anything about the buyer.
function statusOf(o) {
  if (o.status === 'earned') return { cls: 'ok', text: 'Cleared' };
  if (o.status === 'held') {
    const m = /Counts from (\d{4}-\d{2}-\d{2})/.exec(o.why || '');
    return { cls: 'wait', text: m ? 'Clears ' + when(Date.parse(m[1] + 'T12:00:00Z')) : 'Pending' };
  }
  if (/Refunded|Disputed/.test(o.why)) return { cls: 'void', text: 'Refunded, not counted' };
  if (/own order/.test(o.why)) return { cls: 'void', text: 'Your own order, not counted' };
  if (/Same buyer/.test(o.why)) return { cls: 'void', text: `Same buyer within ${REPEAT_DAYS} days` };
  return { cls: 'void', text: 'Not counted' };
}

function bar(done, goal) {
  const pct = Math.min(100, Math.round((done / goal) * 100));
  return `<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${goal}" aria-valuenow="${Math.min(done, goal)}"><i style="width:${pct}%"></i></div>`;
}

function page(c, origin) {
  const first = (c.name || '').trim().split(/\s+/)[0] || 'there';
  const live = c.orders.filter((o) => o.status !== 'void');
  const sold = live.reduce((a, o) => a + o.rolls, 0);
  const total = c.earnedCents + c.heldCents;
  const ready = Math.max(0, c.owedCents);
  const share = `${origin}/?code=${encodeURIComponent(c.code)}`;
  const shareShort = share.replace(/^https?:\/\//, '');

  const rows = c.orders.slice().reverse().map((o) => {
    const st = statusOf(o);
    return `<li class="${st.cls}"><div><b>${o.rolls} roll${o.rolls > 1 ? 's' : ''}</b><small>${when(o.at)}</small></div>
      <div class="r"><b>${o.status === 'void' ? '$0' : '+' + usd(o.commissionCents)}</b><small>${esc(st.text)}</small></div></li>`;
  }).join('');

  const freeLine = c.freeRoll === 'sent' ? 'Your free roll is on its way.'
    : c.freeRoll === 'due' ? "You've earned your free roll. We'll be in touch to send it."
    : sold >= FREE_ROLL_AT ? 'Unlocked once those rolls clear.'
    : `${FREE_ROLL_AT - sold} more roll${FREE_ROLL_AT - sold === 1 ? '' : 's'} to go.`;
  const boostLine = sold >= BOOST_AT ? `You're on $${BOOST_RATE} a roll once those clear.` : `${BOOST_AT - sold} more roll${BOOST_AT - sold === 1 ? '' : 's'} to go.`;

  const holdNote = PREORDER
    ? `Pre-orders clear ${HOLD_AFTER_SHIP_DAYS} days after they ship (rolls ship by ${SHIP_BY}). That window is for refunds, so a cancelled order never comes back out of your pay.`
    : `Sales clear ${HOLD_DAYS} days after the order. That window is for refunds, so a cancelled order never comes back out of your pay.`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><meta name="theme-color" content="#0B1F9E">
<title>Your Founding Crew dashboard | Blue Hour</title><link rel="icon" href="/favicon.png">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,300;0,400;0,600;0,800;1,800&display=swap">
<style>
:root{--deep:#0B1F9E;--cobalt:#1436D8;--dawn:#62B8FF;--pale:#A9D8FF;--first:#D7F0FF;--ink:#141A3C;--mist:#F2F8FF;--soft:#4B5272;--line:#D9E2F2;--green:#0B7A3B}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;font:400 16px/1.5 Poppins,-apple-system,Arial,sans-serif;color:var(--ink);background:var(--mist)}
.sky{background:linear-gradient(180deg,#081673 0%,var(--deep) 38%,var(--cobalt) 78%,#2A74FF 100%);color:#fff;padding:max(22px,env(safe-area-inset-top)) 22px 64px}
.top{display:flex;justify-content:space-between;align-items:center;max-width:620px;margin:0 auto}
.top img{height:22px;width:auto}.tag{font-size:13px;font-weight:600;color:var(--pale)}
.hero{max-width:620px;margin:38px auto 0}
.hi{margin:0;font-weight:600;font-size:18px;color:var(--pale)}
.big{margin:4px 0 0;font-weight:800;font-style:italic;font-size:clamp(76px,24vw,128px);line-height:.9;letter-spacing:-.06em;color:#fff}
.big span{font-size:.5em;vertical-align:.62em;margin-right:.04em;font-style:normal;color:var(--dawn)}
.sub{margin:12px 0 0;font-size:15px;color:#E6F3FF;max-width:30em}
.sub b{color:#fff;font-weight:600}
main{max-width:620px;margin:-38px auto 0;padding:0 16px max(40px,env(safe-area-inset-bottom));display:grid;grid-template-columns:minmax(0,1fr);gap:14px}
.card{background:#fff;border-radius:22px;padding:20px;box-shadow:0 10px 30px rgba(11,31,158,.10)}
h2{margin:0 0 12px;font-weight:600;font-size:15px;color:var(--soft)}
.code{display:flex;align-items:end;justify-content:space-between;gap:12px;flex-wrap:wrap}
.code strong{font-weight:800;font-size:40px;letter-spacing:.02em;line-height:1;color:var(--cobalt)}
.code p{margin:6px 0 0;font-size:14px;color:var(--soft)}
.link{margin-top:14px;display:flex;gap:8px;align-items:center;background:var(--mist);border-radius:14px;padding:6px 6px 6px 14px}
.link span{flex:1;min-width:0;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
button{font:600 15px Poppins,Arial,sans-serif;border:0;border-radius:11px;background:var(--ink);color:#fff;padding:11px 16px;cursor:pointer;min-height:44px}
button:focus-visible{outline:3px solid var(--dawn);outline-offset:2px}
.nums{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.nums div{background:#fff;border-radius:16px;padding:14px 12px;box-shadow:0 6px 18px rgba(11,31,158,.07)}
.nums b{display:block;font-weight:800;font-size:24px;letter-spacing:-.03em;line-height:1.1}
.nums small{font-size:12.5px;color:var(--soft)}
.goal+.goal{margin-top:16px}
.goal p{margin:0;display:flex;justify-content:space-between;gap:10px;font-size:15px}
.goal p b{font-weight:600}.goal p span{color:var(--soft);font-size:14px}
.goal em{display:block;font-style:normal;font-size:13.5px;color:var(--soft);margin-top:6px}
.bar{height:10px;border-radius:99px;background:var(--first);margin-top:8px;overflow:hidden}
.bar i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,var(--cobalt),var(--dawn))}
ul{list-style:none;margin:0;padding:0}
li{display:flex;justify-content:space-between;gap:12px;padding:12px 0;border-top:1px solid var(--line)}
li:first-child{border-top:0;padding-top:2px}
li b{display:block;font-weight:600}li small{display:block;font-size:13px;color:var(--soft)}
li .r{text-align:right}li.ok .r b{color:var(--green)}li.wait .r b{color:var(--cobalt)}
li.void b{color:#8A90AD;font-weight:400}
.empty{margin:0;color:var(--soft);font-size:15px}
.paused{background:#FFE1E6;color:#7A0E23;border-radius:16px;padding:14px 16px;font-weight:600;font-size:15px;margin:0}
.fine{margin:0;font-size:14px;color:var(--soft)}.fine+.fine{margin-top:8px}.fine a{color:var(--cobalt)}
.stamp{text-align:center;font-size:13px;color:var(--soft);margin:4px 0 0}
@media (max-width:380px){.nums{grid-template-columns:1fr 1fr}.nums div:last-child{grid-column:span 2}}
@media (prefers-reduced-motion:no-preference){.bar i{animation:grow 1.1s cubic-bezier(.19,1,.22,1) both}@keyframes grow{from{width:0}}}
</style></head><body>
<header class="sky">
  <div class="top"><img src="/images/logo-white.webp" alt="Blue Hour"><span class="tag">Founding Crew</span></div>
  <div class="hero">
    <p class="hi">Hey ${esc(first)}, you've earned</p>
    <p class="big"><span>$</span>${esc(total % 100 ? (total / 100).toFixed(2) : String(total / 100))}</p>
    <p class="sub">${total ? `<b>${usd(ready)}</b> is ready to pay out and <b>${usd(c.heldCents)}</b> is waiting to clear.` : `Your first sale shows up here the moment it's paid. You earn $${CREW_RATE} for every roll.`}</p>
  </div>
</header>
<main>
  ${c.active ? '' : '<p class="paused">Your code is paused right now, so it won\'t work at checkout. Email us if you think that\'s a mistake.</p>'}
  <section class="card">
    <h2>Your code</h2>
    <div class="code"><div><strong>${esc(c.code)}</strong><p>Your friends get $${CREW_OFF} off every roll.</p></div></div>
    <div class="link"><span>${esc(shareShort)}</span><button type="button" data-copy="${esc(share)}">Copy link</button></div>
  </section>
  <section class="nums" aria-label="Your numbers">
    <div><b>${sold}</b><small>Rolls sold</small></div>
    <div><b>${usd(ready)}</b><small>Next payout</small></div>
    <div><b>${usd(c.paidCents)}</b><small>Paid to you</small></div>
  </section>
  <section class="card">
    <h2>What you're working toward</h2>
    <div class="goal"><p><b>A free roll</b><span>${Math.min(sold, FREE_ROLL_AT)} of ${FREE_ROLL_AT}</span></p>${bar(sold, FREE_ROLL_AT)}<em>${esc(freeLine)}</em></div>
    <div class="goal"><p><b>$${BOOST_RATE} a roll</b><span>${Math.min(sold, BOOST_AT)} of ${BOOST_AT}</span></p>${bar(sold, BOOST_AT)}<em>${esc(boostLine)} Every roll after ${BOOST_AT} pays $${BOOST_RATE}.</em></div>
  </section>
  <section class="card">
    <h2>Your sales</h2>
    ${rows ? `<ul>${rows}</ul>` : `<p class="empty">No sales yet. Share your link with the people you go out with and they'll show up here.</p>`}
  </section>
  <section class="card">
    <h2>How you get paid</h2>
    <p class="fine">${esc(holdNote)}</p>
    <p class="fine">Once a sale clears, we pay you by PayPal at the start of each month${c.paypal ? ` to ${esc(c.paypal)}` : ''}.</p>
    <p class="fine">Questions? Email <a href="mailto:hello@bluehournights.com">hello@bluehournights.com</a>. Keep this link to yourself: it's your private page.</p>
  </section>
  <p class="stamp">Updated ${new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' })} Pacific. Refresh to see new sales.</p>
</main>
<script>
document.querySelectorAll('[data-copy]').forEach(function(b){b.addEventListener('click',function(){
  var t=b.getAttribute('data-copy');
  function done(){b.textContent='Copied';setTimeout(function(){b.textContent='Copy link'},1800)}
  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(done,function(){prompt('Copy your link',t)})}else{prompt('Copy your link',t)}
})});
</script>
</body></html>`;
}

const notFound = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Link not found | Blue Hour</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;800&display=swap">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font:400 16px/1.5 Poppins,Arial,sans-serif;background:linear-gradient(180deg,#0B1F9E,#1436D8);color:#fff;padding:24px;text-align:center}h1{font-weight:800;font-size:32px;margin:0 0 8px}a{color:#A9D8FF}</style></head>
<body><div><h1>This link doesn't work</h1><p>Use the dashboard link we sent you, or email <a href="mailto:hello@bluehournights.com">hello@bluehournights.com</a> for a new one.</p></div></body></html>`;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const q = req.query || {};
  const code = cleanCrewCode(q.c);
  if (!code || !dashOk(code, q.t)) return res.status(404).send(notFound);
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return res.status(503).send(notFound);
  try {
    const [crews, orders] = await Promise.all([listCrew(key), listCrewOrders(key)]);
    const mine = crews.filter((c) => c.code === code);
    if (!mine.length) return res.status(404).send(notFound);
    const [row] = ledger(mine, orders, { shipByFull: SHIP_BY_FULL });
    const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0];
    const origin = `${proto}://${req.headers['x-forwarded-host'] || req.headers.host}`;
    return res.status(200).send(page(row, origin));
  } catch (e) {
    console.error('Crew dashboard failed:', e);
    return res.status(502).send(notFound.replace("This link doesn't work", 'Back in a minute').replace(/Use the dashboard.*?new one\./, 'We couldn\'t load your numbers just now. Refresh in a minute.'));
  }
}
