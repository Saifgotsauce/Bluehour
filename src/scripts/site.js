// Blue Hour site behaviour: cart, menu, carousels, buy bar and the small animations.
// Every block checks that its elements exist, because each page only has some of them.

import { EGGS, eggById, inBlueHour, COLLECTOR_NEEDS } from '../data/eggs.js';
import { PRICE, MAX_CAPS, INGREDIENTS, SIGNATURE, cleanMix, mixTotal, mixKey, isSignature, mixSummary, packSummary, eachFor, totalFor, savingFor, nextTier } from '../data/ingredients.js';


const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const money = (n) => '$' + n.toFixed(2);
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } },
};
const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- discount codes ---------- */
// A code arrives in a link (bluehournights.com/?code=RAVE15) or from the welcome offer. It's checked with
// Stripe through /api/promo, saved for 14 days, shown at the top of the page and applied at checkout.
const CODE_DAYS = 14;
function getCode() {
  try {
    const c = JSON.parse(store.get('bh-code') || 'null');
    if (c && c.code && Date.now() - c.at < CODE_DAYS * 864e5) return c;
  } catch (e) { /* ignore */ }
  return null;
}
function setCode(c) {
  if (c && c.code) store.set('bh-code', JSON.stringify({ code: c.code, label: c.label || 'Discount', at: c.at || Date.now(), checked: Date.now() }));
  else store.set('bh-code', '');
  codeBar(); paint();
}
let promoDefault = null;
function codeBar() {
  let bar = $('.promo');
  const c = getCode(), egg = bestEgg();
  if (!bar && !c && !egg) return;
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'promo';
    const first = document.body.firstElementChild;
    document.body.insertBefore(bar, first && first.tagName.toLowerCase() === 'svg' ? first.nextSibling : first);
  }
  if (promoDefault === null) promoDefault = bar.innerHTML;
  if (egg && c) {
    bar.classList.add('coded');
    bar.innerHTML = '<b>' + c.code.replace(/[^\w-]/g, '') + '</b> and the <b>' + egg.name + '</b> egg saved. Your best one comes off at checkout.';
  } else if (egg) {
    bar.classList.add('coded');
    bar.innerHTML = '<b>' + egg.name + '</b> egg found: $' + egg.amount + ' off, applied at checkout. ' + eggsFoundCount() + ' of ' + EGGS.length + ' found.';
  } else if (c) { bar.classList.add('coded'); bar.innerHTML = '<b>' + c.code.replace(/[^\w-]/g, '') + '</b> saved: ' + c.label.replace(/[<>&"]/g, '') + ', applied at checkout.'; }
  else if (promoDefault) { bar.classList.remove('coded'); bar.innerHTML = promoDefault; }
  else bar.remove();
}
const checkPromo = (code) =>
  fetch('/api/promo?code=' + encodeURIComponent(code)).then((r) => r.json()).catch(() => ({}));
(function readCodeFromLink() {
  let url;
  try { url = new URL(location.href); } catch (e) { return; }
  const key = ['code', 'promo', 'discount'].find((k) => url.searchParams.get(k));
  if (key) {
    const code = url.searchParams.get(key).trim();
    url.searchParams.delete(key);
    try { history.replaceState(history.state, '', url.pathname + url.search + url.hash); } catch (e) { /* ignore */ }
    checkPromo(code).then((d) => { if (d.valid) setCode({ code: d.code, label: d.label }); });
    return;
  }
  // Re-check a saved code now and then, in case it was switched off in Stripe.
  const c = getCode();
  if (c && Date.now() - (c.checked || 0) > 6 * 36e5) {
    checkPromo(c.code).then((d) => { if (d.valid) setCode({ ...c, label: d.label }); else if (d.valid === false) setCode(null); });
  }
})();

/* ---------- easter eggs ---------- */
// Hidden discounts (see src/data/eggs.js). Finding one asks /api/egg for a signed token, kept in this
// browser for 48 hours and sent with the order. Checkout applies the best single discount the shopper has.
function eggStore() {
  try { return JSON.parse(store.get('bh-eggs') || '{}') || {}; } catch (e) { return {}; }
}
function liveEggs() {
  const all = eggStore(), now = Date.now(), out = [];
  Object.keys(all).forEach((id) => {
    const e = eggById(id), t = all[id];
    if (e && t && t.token && t.x > now) out.push({ ...e, token: t.token, amount: t.amount, x: t.x });
  });
  return out;
}
function bestEgg() { return liveEggs().sort((a, b) => b.amount - a.amount)[0] || null; }
function eggsFoundCount() {
  try { return (JSON.parse(store.get('bh-eggs-seen') || '[]') || []).length; } catch (e) { return 0; }
}
const asking = new Set();
async function findEgg(id) {
  const egg = eggById(id);
  if (!egg || asking.has(id) || liveEggs().some((e) => e.id === id)) return;
  asking.add(id);
  try {
    const r = await fetch('/api/egg', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ egg: id, offset: -new Date().getTimezoneOffset(), have: liveEggs().map((e) => e.token) }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.token) return;
    const all = eggStore();
    all[id] = { token: d.token, amount: d.amount, x: d.expires };
    store.set('bh-eggs', JSON.stringify(all));
    let seen = [];
    try { seen = JSON.parse(store.get('bh-eggs-seen') || '[]') || []; } catch (e) { /* ignore */ }
    if (!seen.includes(id)) { seen.push(id); store.set('bh-eggs-seen', JSON.stringify(seen)); }
    eggToast(egg, d.amount);
    codeBar(); paint();
    if (id !== 'collector' && liveEggs().filter((e) => e.id !== 'collector').length >= COLLECTOR_NEEDS) {
      setTimeout(() => findEgg('collector'), 2600);
    }
  } catch (e) { /* offline: they can find it again */ } finally { asking.delete(id); }
}
function eggToast(egg, amount) {
  $$('.egg').forEach((t) => t.remove());
  const seen = (() => { try { return JSON.parse(store.get('bh-eggs-seen') || '[]') || []; } catch (e) { return []; } })();
  const ring = (egg.rarity + ' egg \u2022 ').toUpperCase().repeat(2);
  const t = document.createElement('div');
  t.className = 'egg ' + egg.rarity;
  t.setAttribute('role', 'status');
  t.innerHTML =
    '<div class="eggbadge"><svg viewBox="0 0 120 120" aria-hidden="true"><path id="eggring" d="M60 60m-45 0a45 45 0 1 1 90 0a45 45 0 1 1-90 0" fill="none"/>' +
    '<text><textPath href="#eggring" textLength="280" lengthAdjust="spacing">' + ring + '</textPath></text></svg><b>$' + amount + '</b><i>off</i></div>' +
    '<div class="eggtxt"><span class="r">' + egg.rarity + ' egg found</span><b>' + egg.name + '</b><p>' + egg.found +
    ' Yours for 48 hours, taken off at checkout.</p><div class="eggdots" aria-label="' + seen.length + ' of ' + EGGS.length + ' eggs found">' +
    EGGS.map((e) => '<i class="' + (seen.includes(e.id) ? 'f' : '') + (e.id === egg.id ? ' now' : '') + '"></i>').join('') +
    '<small>' + seen.length + ' of ' + EGGS.length + ' found</small></div></div>' +
    '<button class="eggx" aria-label="Close"><svg viewBox="0 0 24 24"><use href="#i-x"/></svg></button>';
  document.body.append(t);
  let gone = false;
  const bye = () => { if (gone) return; gone = true; t.classList.remove('on'); t.classList.add('off'); setTimeout(() => t.remove(), 800); };
  t.addEventListener('click', bye);
  requestAnimationFrame(() => requestAnimationFrame(() => { t.classList.add('on'); setTimeout(() => burst(t.querySelector('.eggbadge'), egg.rarity), 380); }));
  setTimeout(bye, 8000);
}
// A handful of capsules burst out of the badge and fall away.
function burst(from, rarity) {
  if (reduce || !from || !from.animate) return;
  const r = from.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const imgs = ['cap-still', 'cap-bright', 'cap-steady', 'cap-guard', 'cap-glycine', 'cap-nac', 'cap-probiotic'];
  const n = rarity === 'legendary' ? 22 : rarity === 'rare' ? 16 : 11;
  const layer = document.createElement('div');
  layer.className = 'eggburst';
  document.body.append(layer);
  for (let k = 0; k < n; k++) {
    const im = document.createElement('img');
    im.src = '/images/' + imgs[k % imgs.length] + '.webp'; im.alt = '';
    im.style.left = cx + 'px'; im.style.top = cy + 'px';
    layer.append(im);
    const a = (-90 + (Math.random() * 150 - 75)) * Math.PI / 180;
    const d = 110 + Math.random() * (rarity === 'legendary' ? 230 : 170);
    const x = Math.cos(a) * d, y = Math.sin(a) * d, spin = (Math.random() < 0.5 ? -1 : 1) * (240 + Math.random() * 420);
    const s = 0.55 + Math.random() * 0.5, dur = 1300 + Math.random() * 700;
    im.animate([
      { transform: 'translate(-50%,-50%) translate(0,0) rotate(0deg) scale(.2)', opacity: 0 },
      { transform: `translate(-50%,-50%) translate(${x * 0.9}px,${y * 0.9}px) rotate(${spin * 0.6}deg) scale(${s})`, opacity: 1, offset: 0.45 },
      { transform: `translate(-50%,-50%) translate(${x * 1.15}px,${y * 0.7 + 160}px) rotate(${spin}deg) scale(${s * 0.9})`, opacity: 0 },
    ], { duration: dur, easing: 'cubic-bezier(.19,1,.22,1)', delay: k * 14, fill: 'forwards' });
  }
  setTimeout(() => layer.remove(), 2400);
}
// Egg: collector. Hold 3 other eggs at once (checked again on every page, in case they left mid-find).
if (liveEggs().filter((e) => e.id !== 'collector').length >= COLLECTOR_NEEDS) setTimeout(() => findEgg('collector'), 2400);
// Egg: blue hour. Visit between 5 and 7 in the morning, your time.
if (inBlueHour(new Date().getHours())) setTimeout(() => findEgg('bluehour'), 1800);
// Egg: PLUR. Type it anywhere on a keyboard, or into an email box on a phone.
let typed = '';
document.addEventListener('keydown', (e) => {
  const tg = e.target;
  if (tg instanceof Element && tg.closest('input, textarea, select')) return;
  if (!e.key || e.key.length !== 1) return;
  typed = (typed + e.key.toLowerCase()).slice(-4);
  if (typed === 'plur') findEgg('plur');
});
const isPlur = (v) => String(v || '').trim().toLowerCase() === 'plur';

/* ---------- cart ---------- */
// Each cart line is one pouch recipe and how many rolls of it: { mix: { level: 2, ... }, qty: 1 }.
let picked = 1;
let current = { ...SIGNATURE };

function loadCart() {
  try {
    const raw = JSON.parse(store.get('bh-cart2') || 'null');
    if (Array.isArray(raw)) {
      return raw
        .map((l) => ({ mix: cleanMix(l.mix), qty: Math.max(1, Math.min(9, parseInt(l.qty, 10) || 1)) }))
        .filter((l) => mixTotal(l.mix) > 0);
    }
  } catch (e) { /* ignore a broken saved cart */ }
  const old = parseInt(store.get('bh-cart') || '0', 10) || 0;
  return old ? [{ mix: { ...SIGNATURE }, qty: Math.min(9, old) }] : [];
}
let cart = loadCart();
const save = () => store.set('bh-cart2', JSON.stringify(cart));
const cartCount = () => cart.reduce((a, l) => a + l.qty, 0);
const lineTitle = (mix) => (isSignature(mix) ? 'Signature pouch' : 'Custom pouch');

function addToCart(mix, qty, quiet) {
  const clean = cleanMix(mix);
  if (!mixTotal(clean)) return;
  const line = cart.find((l) => mixKey(l.mix) === mixKey(clean));
  if (line) line.qty = Math.min(9, line.qty + qty);
  else cart.push({ mix: clean, qty });
  save(); paint();
  if (!quiet) openCart();
}

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function paint() {
  const n = cartCount();
  $$('.count').forEach((c) => { c.hidden = !n; c.textContent = n; });
  const title = $('#carttitle');
  if (!title) return;
  title.textContent = n ? 'Cart • ' + n : 'Cart';
  $('#shipbox').hidden = !n;
  $('#cft').hidden = !n;
  $('#checkout').textContent = 'Checkout • ' + money(totalFor(n));
  const box = $('#citems');
  if (!n) {
    box.innerHTML = '<div class="empty"><h3>Your cart is empty.</h3><p>Your next 30 nights are one tap away.</p><a class="btn solid" href="/shop">Shop 30 nights</a></div>';
    return;
  }
  // Crew pricing progress: the more rolls in the order, the less each one costs.
  const each = eachFor(n), next = nextTier(n), saving = savingFor(n);
  $('#crewmsg').innerHTML = next
    ? (saving ? 'You\'re paying $' + each + ' a roll. ' : '') + 'Add ' + (next.rolls - n) + ' more roll' + (next.rolls - n > 1 ? 's' : '') +
      ' and every roll drops to <b>$' + next.each + '</b>.'
    : 'Crew price unlocked: <b>$' + each + ' a roll</b>, saving you $' + saving + '.';
  $('#crewbar').style.width = Math.min(100, (n / 3) * 100) + '%';
  $('#upsell').hidden = !next;
  box.innerHTML = cart.map((l, i) =>
    '<div class="line"><img src="/images/flat.webp" alt="" width="82" height="102"><div><h3>' + lineTitle(l.mix) +
    '</h3><div class="mt">' + packSummary(l.mix) + '</div><div class="mt">30 nights per roll</div><div class="ctl"><div class="qty"><button data-line="' + i +
    '" data-d="-1" aria-label="Remove one roll">−</button><span>' + l.qty + '</span><button data-line="' + i +
    '" data-d="1" aria-label="Add one roll">+</button></div><div class="price">' +
    (each < PRICE ? '<s>' + money(l.qty * PRICE) + '</s> ' : '') + money(l.qty * each) +
    '</div></div><button class="trash" data-rm="' + i + '">Remove</button></div></div>'
  ).join('');
  const code = getCode(), egg = bestEgg(), cl = $('#codeline');
  cl.hidden = !code && !egg;
  cl.innerHTML =
    (egg ? '<span><b>' + esc(egg.name) + '</b> egg · $' + egg.amount + ' off</span>' : '') +
    (code ? '<span><b>' + esc(code.code) + '</b> · ' + esc(code.label) + ' <button data-dropcode>Remove</button></span>' : '') +
    '<small>' + (code && egg ? 'Only your best discount applies at checkout.' : 'Applied at checkout.') + '</small>';
}

const citems = $('#citems');
if (citems) {
  citems.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    const q = t.closest('[data-line]');
    const rm = t.closest('[data-rm]');
    if (q) {
      const l = cart[+q.getAttribute('data-line')];
      if (!l) return;
      l.qty = Math.min(9, l.qty + +q.getAttribute('data-d'));
      if (l.qty < 1) cart.splice(cart.indexOf(l), 1);
    } else if (rm) {
      cart.splice(+rm.getAttribute('data-rm'), 1);
    } else return;
    save(); paint();
  });
}

/* ---------- build your pouch (shop) ---------- */
const build = $('#build');
function paintBuilder() {
  const t = mixTotal(current);
  $$('[data-add], [data-buy]').forEach((b) => { b.disabled = t === 0; });
  const sum = $('#mixsum');
  if (sum) sum.textContent = t === 0 ? 'Pick at least one capsule.' : (isSignature(current) ? 'Signature six: ' : 'Your custom ' + t + ': ') + mixSummary(current);
  if (!build) return;
  $$('.icard', build).forEach((card) => {
    const id = card.getAttribute('data-id'), max = +card.getAttribute('data-max'), n = current[id] || 0;
    $('[data-n]', card).textContent = String(n);
    card.classList.toggle('on', n > 0);
    $('[data-inc]', card).disabled = n >= max || t >= MAX_CAPS;
    $('[data-dec]', card).disabled = n <= 0;
  });
  const imgs = [];
  INGREDIENTS.forEach((i) => { for (let k = 0; k < (current[i.id] || 0); k++) imgs.push(i.img); });
  $$('#slots i').forEach((slot, k) => {
    slot.classList.toggle('on', k < imgs.length);
    slot.innerHTML = k < imgs.length ? '<img src="/images/' + imgs[k] + '.webp" alt="">' : '';
  });
  const tally = $('#tally');
  if (tally) tally.textContent = t + ' of ' + MAX_CAPS;
}
if (build) {
  build.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    if (t.closest('#reset')) { current = { ...SIGNATURE }; paintBuilder(); return; }
    const card = t.closest('.icard');
    if (!card) return;
    const id = card.getAttribute('data-id');
    if (t.closest('[data-inc]')) current = cleanMix({ ...current, [id]: (current[id] || 0) + 1 });
    else if (t.closest('[data-dec]')) current = cleanMix({ ...current, [id]: (current[id] || 0) - 1 });
    else return;
    paintBuilder();
  });
}

const lock = (on) => { document.documentElement.style.overflow = on ? 'hidden' : ''; };
function openCart() {
  const c = $('#cart'); if (!c) return;
  $('#chknote').hidden = true;
  c.classList.add('on'); c.inert = false;
  $('#scrim').classList.add('on'); lock(true); $('#cartx').focus();
}
function openMenu() {
  const m = $('#menu'); if (!m) return;
  m.classList.add('on'); m.inert = false; lock(true); $('#menux').focus();
}
function closeAll() {
  ['#cart', '#menu'].forEach((s) => { const el = $(s); if (el) { el.classList.remove('on'); el.inert = true; } });
  const sc = $('#scrim'); if (sc) sc.classList.remove('on');
  lock(false);
}

const tossed = new Set();
let taps = 0, lastTap = 0;
document.addEventListener('click', (e) => {
  const t = e.target;
  if (!(t instanceof Element)) return;
  if (t.closest('[data-cart]')) { openCart(); return; }
  if (t.closest('[data-menu]')) { openMenu(); return; }
  const buy = t.closest('[data-buy]');
  if (buy) { if (!buy.disabled) { addToCart(current, picked, true); goCheckout(buy); } return; }
  if (t.closest('[data-add]')) { addToCart(current, picked); return; }
  if (t.closest('#upsell')) { addToCart(SIGNATURE, 1, true); return; }
  if (t.closest('[data-dropcode]')) { setCode(null); return; }
  if (t.closest('#menu a, #cart a')) { closeAll(); return; }
  const cap = t.closest('.cap');
  if (cap) {
    cap.classList.remove('flick'); void cap.offsetWidth; cap.classList.add('flick');
    // Egg: capsule toss. Flick every floating capsule on the page.
    // Each flicked capsule stays lit, so you can tell how many are left.
    tossed.add(cap); cap.classList.add('got');
    if (tossed.size === $$('.cap').length) {
      setTimeout(() => $$('.cap').forEach((c) => { c.classList.remove('flick'); void c.offsetWidth; c.classList.add('flick'); }), 350);
      findEgg('toss');
    }
    return;
  }
  // Egg: read to the end. A stray capsule waits at the bottom of every Journal post.
  const stray = t.closest('[data-egg="reader"]');
  if (stray) { stray.classList.add('got'); findEgg('reader'); return; }
  // Egg: lights up. Tap the big footer logo 5 times in a row.
  const logo = t.closest('.fbig');
  if (logo) {
    const now = Date.now();
    taps = now - lastTap < 900 ? taps + 1 : 1; lastTap = now;
    logo.classList.remove('blink'); void logo.offsetWidth; logo.classList.add('blink');
    if (taps >= 5) { taps = 0; $('.foot').classList.add('lit'); findEgg('lights'); }
  }
});
['#cartx', '#menux', '#scrim'].forEach((s) => { const el = $(s); if (el) el.addEventListener('click', closeAll); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); });
// Sends the cart (and any saved discount code) to /api/checkout, which opens Stripe's payment page.
const checkout = $('#checkout');
let leaving = false;
async function goCheckout(btn) {
  if (!cart.length || leaving) return;
  leaving = true;
  const label = btn.innerHTML;
  const note = $('#chknote');
  if (note) note.hidden = true;
  btn.dataset.label = label;
  btn.disabled = true;
  btn.textContent = 'Opening secure checkout\u2026';
  let msg = "Checkout couldn't open. Check your connection and try again.";
  try {
    const code = getCode();
    const r = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lines: cart, code: code ? code.code : '', egg: (bestEgg() || {}).token || '' }),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok && d.url) { location.href = d.url; return; }
    if (d.error === 'not_configured') msg = "Checkout isn't switched on yet. Please check back soon.";
  } catch (e) { /* message below */ }
  leaving = false;
  btn.disabled = false;
  btn.innerHTML = label;
  if (btn !== checkout) openCart();
  if (note) { note.textContent = msg; note.hidden = false; }
  paint();
}
if (checkout) checkout.addEventListener('click', () => { if (!checkout.disabled) goCheckout(checkout); });
// Coming back from Stripe with the back button: make the buttons usable again.
window.addEventListener('pageshow', (e) => {
  if (!e.persisted) return;
  leaving = false;
  cart = loadCart();
  $$('[data-buy]').forEach((b) => { b.disabled = false; if (b.dataset.label) b.innerHTML = b.dataset.label; });
  if (checkout) checkout.disabled = false;
  paint();
});

/* ---------- quantity pickers (shop) ---------- */
// The roll cards in the buy box and the dropdown in the sticky bar stay in sync.
function setPicked(n) {
  picked = Math.max(1, Math.min(9, n || 1));
  $$('[data-qty]').forEach((o) => {
    if (o.type === 'radio') o.checked = +o.value === picked;
    else o.value = String(picked);
  });
  $$('[data-price]').forEach((p) => { p.textContent = money(totalFor(picked)); });
  $$('[data-price-short]').forEach((p) => { p.textContent = '$' + totalFor(picked); });
  $$('[data-rolls]').forEach((p) => { p.textContent = picked + (picked > 1 ? ' rolls' : ' roll'); });
}
$$('[data-qty]').forEach((el) => el.addEventListener('change', () => setPicked(parseInt(el.value, 10))));

/* ---------- carousels ---------- */
let lastPageScroll = 0;
window.addEventListener('scroll', () => { lastPageScroll = performance.now(); }, { passive: true });
$$('[data-car]').forEach((car) => {
  const tr = $('.track', car), dots = $('.dots', car);
  if (!tr || !dots) return;
  const n = tr.children.length; let cur = 0, user = false;
  for (let i = 0; i < n; i++) {
    const b = document.createElement('button');
    b.setAttribute('aria-label', 'Show ' + (i + 1) + ' of ' + n);
    b.addEventListener('click', () => { user = true; go(i); });
    dots.appendChild(b);
  }
  const mark = () => { [...dots.children].forEach((b, i) => b.classList.toggle('on', i === cur)); };
  const go = (i) => tr.scrollTo({ left: tr.clientWidth * i, behavior: reduce ? 'auto' : 'smooth' });
  tr.addEventListener('scroll', () => {
    const i = Math.round(tr.scrollLeft / Math.max(1, tr.clientWidth));
    if (i !== cur) { cur = i; mark(); }
  }, { passive: true });
  ['pointerdown', 'touchstart'].forEach((ev) => tr.addEventListener(ev, () => { user = true; }, { passive: true }));
  mark();
  if (car.hasAttribute('data-auto') && !reduce) {
    setInterval(() => {
      const r = tr.getBoundingClientRect();
      const settled = performance.now() - lastPageScroll > 1500;
      if (!user && settled && !document.hidden && r.top > 0 && r.bottom < innerHeight) go((cur + 1) % n);
    }, 4200);
  }
});

/* ---------- FAQ accordion ---------- */
// Quick, light open and close: only the answer's height and opacity move.
const FAQ_EASE = 'cubic-bezier(.2,.8,.2,1)';
$$('.faq details').forEach((d) => {
  const sum = $('summary', d), body = $('p', d);
  if (!sum || !body || reduce || !body.animate) return;
  let anim = null;
  sum.addEventListener('click', (e) => {
    e.preventDefault();
    if (anim) anim.cancel();
    if (!d.open) {
      d.open = true;
      d.classList.remove('closing');
      anim = body.animate([{ height: '0px', paddingBottom: '0px', opacity: 0 }, { height: body.scrollHeight + 'px', paddingBottom: '24px', opacity: 1 }], { duration: 260, easing: FAQ_EASE });
      anim.onfinish = () => { anim = null; };
    } else {
      d.classList.add('closing');
      anim = body.animate([{ height: body.offsetHeight + 'px', paddingBottom: '24px', opacity: 1 }, { height: '0px', paddingBottom: '0px', opacity: 0 }], { duration: 200, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'forwards' });
      anim.onfinish = () => { d.open = false; d.classList.remove('closing'); anim.cancel(); anim = null; };
    }
  });
});

/* ---------- email sign-up and the welcome offer ---------- */
// Both the footer form and the popup post to /api/subscribe, which adds the email to Klaviyo and returns
// the welcome code. The code is saved like a link code, so it comes off at checkout without typing it.
async function subscribe(email, when, source) {
  try {
    const r = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, when, source }),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok && d.ok) {
      store.set('bh-sub', '1');
      if (d.code) setCode({ code: d.code, label: d.label });
      return { ok: true, code: d.code };
    }
    return { ok: false, error: d.error || 'failed' };
  } catch (e) { return { ok: false, error: 'offline' }; }
}
const subError = (e) =>
  e === 'bad_email' ? 'That email doesn\'t look right. Check it and try again.'
  : e === 'not_configured' ? 'Sign-ups go live very soon.'
  : 'That didn\'t go through. Try again in a moment.';

$$('.foot .form').forEach((f) => {
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const note = $('.formnote', f.parentNode), input = $('input', f), btn = $('button', f);
    if (btn.disabled) return;
    if (isPlur(input.value)) { input.value = ''; findEgg('plur'); return; }
    btn.disabled = true;
    const r = await subscribe(input.value, '', 'footer');
    btn.disabled = false;
    if (r.ok) { input.value = ''; note.textContent = r.code ? 'You\'re in. Code ' + r.code + ' is saved and comes off at checkout.' : 'You\'re in. See you in your inbox.'; }
    else note.textContent = subError(r.error);
  });
});

const POP_SKIP = /^\/(thank-you|privacy|terms|refunds|shipping|contact)/;
const WHENS = [['this-weekend', 'This weekend'], ['this-month', 'This month'], ['later', 'Later this year'], ['every-weekend', 'Every weekend']];
function popAllowed() {
  if (POP_SKIP.test(location.pathname) || store.get('bh-sub') || getCode()) return false;
  if (Date.now() - (+store.get('bh-pop') || 0) < 14 * 864e5) return false;
  try { if (sessionStorage.getItem('bh-pop')) return false; } catch (e) { /* ignore */ }
  return true;
}
let popArmed = popAllowed();
function tryPop() {
  if (!popArmed) return;
  if ($('#cart.on, #menu.on')) { setTimeout(tryPop, 6000); return; }
  popArmed = false;
  fetch('/api/subscribe').then((r) => r.json()).then((d) => { if (d.on) openPop(); }).catch(() => {});
}
function openPop() {
  try { sessionStorage.setItem('bh-pop', '1'); } catch (e) { /* ignore */ }
  const onShop = location.pathname.startsWith('/shop');
  const scrim = document.createElement('div');
  scrim.className = 'popscrim';
  const pop = document.createElement('div');
  pop.className = 'wpop';
  pop.setAttribute('role', 'dialog');
  pop.setAttribute('aria-modal', 'true');
  pop.setAttribute('aria-labelledby', 'poph');
  pop.tabIndex = -1;
  pop.innerHTML =
    '<div class="pophd"><div class="grain"></div><button class="popx" aria-label="Close"><svg viewBox="0 0 24 24"><use href="#i-x"/></svg></button>' +
    '<p class="eyebrow">Welcome offer</p><h2 id="poph">10% off your first roll.</h2></div>' +
    '<form class="popbody" novalidate><p class="popq">When\'s your next big night?</p>' +
    '<div class="popchips" role="radiogroup" aria-label="When\'s your next big night?">' +
    WHENS.map(([v, t]) => '<button type="button" role="radio" aria-checked="false" data-when="' + v + '">' + t + '</button>').join('') +
    '</div><p class="pophint" hidden>Heads up: rolls are packed to order and usually arrive 4 to 10 business days after you order.</p>' +
    '<div class="form"><label for="popem" class="sr">Email address</label><input id="popem" type="email" placeholder="Email address" autocomplete="email"><button type="submit">Get 10% off</button></div>' +
    '<p class="fine">We\'ll nudge you to order in time for it. By joining you agree to get marketing emails from Blue Hour. Unsubscribe anytime. <a href="/privacy">Privacy</a></p>' +
    '<p class="formnote" role="status"></p></form>';
  document.body.append(scrim, pop);
  let when = '';
  const close = (done) => {
    if (!done) store.set('bh-pop', String(Date.now()));
    pop.classList.remove('on'); scrim.classList.remove('on');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => { pop.remove(); scrim.remove(); }, 700);
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  scrim.addEventListener('click', () => close());
  pop.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    if (t.closest('.popx')) { close(!!pop.querySelector('.popdone')); return; }
    if (t.closest('[data-keep]')) { close(true); return; }
    const chip = t.closest('[data-when]');
    if (chip) {
      when = chip.getAttribute('aria-checked') === 'true' ? '' : chip.getAttribute('data-when');
      $$('[data-when]', pop).forEach((c) => c.setAttribute('aria-checked', String(c.getAttribute('data-when') === when)));
      $('.pophint', pop).hidden = when !== 'this-weekend';
      return;
    }
    const copy = t.closest('[data-copy]');
    if (copy && navigator.clipboard) navigator.clipboard.writeText(copy.getAttribute('data-copy')).then(() => { copy.textContent = 'Copied'; }).catch(() => {});
  });
  const form = $('form', pop);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('button[type=submit]', form), note = $('.formnote', form);
    if (btn.disabled) return;
    if (isPlur($('input', form).value)) { $('input', form).value = ''; findEgg('plur'); return; }
    btn.disabled = true; btn.textContent = 'Joining\u2026';
    const r = await subscribe($('input', form).value, when, 'popup');
    if (!r.ok) { btn.disabled = false; btn.textContent = 'Get 10% off'; note.textContent = subError(r.error); return; }
    const cta = onShop ? '<button class="btn blue" data-keep>Keep shopping</button>' : '<a class="btn blue" href="/shop">Shop 30 nights</a>';
    form.outerHTML = r.code
      ? '<div class="popbody popdone"><p class="popq">You\'re in. Here\'s your code:</p><div class="codebox"><b>' + r.code.replace(/[^\w-]/g, '') +
        '</b><button data-copy="' + r.code.replace(/[^\w-]/g, '') + '">Copy</button></div><p class="fine">It\'s saved on this device and comes off at checkout automatically.</p>' + cta + '</div>'
      : '<div class="popbody popdone"><p class="popq">You\'re in. Check your inbox.</p>' + cta + '</div>';
  });
  requestAnimationFrame(() => requestAnimationFrame(() => { pop.classList.add('on'); scrim.classList.add('on'); pop.focus({ preventScroll: true }); }));
}
if (popArmed) {
  setTimeout(tryPop, 15000);
  document.addEventListener('mouseout', (e) => { if (!e.relatedTarget && e.clientY <= 0) tryPop(); });
}
function popScroll() {
  if (!popArmed) return;
  const h = document.documentElement.scrollHeight - innerHeight;
  if (h > 400 && scrollY / h > 0.5) tryPop();
}

/* ---------- reveal on scroll ---------- */
// Lists reveal item by item; headings and blocks fade up. Items that come into view together are staggered.
window.__bhMotion = true;
const motion = document.documentElement.classList.contains('js-motion');
if (motion) {
  const inHero = (el) => el.closest('.hero, .phero, .jhero, .menu, .cart');
  $$('.glist, .steps, .wgrid, .tgrid, .ingr, .posts, .ilist, .cgrid').forEach((list) => {
    list.classList.remove('rv');
    [...list.children].forEach((c) => c.classList.add('rv'));
  });
  $$('.sec h2, .lead, .bhead, .chips, .bign, .fullshot img, .why .def, .why p, .tbw, .leftout').forEach((el) => {
    if (inHero(el) || el.closest('.rv') || el.classList.contains('rv')) return;
    if (getComputedStyle(el).transform !== 'none') return; // keeps tilted headings tilted
    el.classList.add('rv');
  });
  const io = new IntersectionObserver((es) => {
    es.filter((e) => e.isIntersecting).forEach((e, i) => {
      e.target.style.setProperty('--d', Math.min(i * 0.08, 0.4) + 's');
      e.target.classList.add('in');
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -10% 0px' });
  $$('.rv').forEach((el) => io.observe(el));
} else {
  $$('.rv').forEach((el) => el.classList.add('in'));
}

// The gradient shimmer on the benefits list only runs while it's on screen.
if ('IntersectionObserver' in window) {
  const live = new IntersectionObserver((es) => es.forEach((e) => e.target.classList.toggle('live', e.isIntersecting)));
  $$('.glist').forEach((g) => live.observe(g));
}

/* ---------- pause animations that are off screen ---------- */
if ('IntersectionObserver' in window) {
  const pause = new IntersectionObserver((es) => es.forEach((e) => e.target.classList.toggle('paused', !e.isIntersecting)));
  $$('.hero, .jhero, .mq, .sky, .dark, .phero, .foot').forEach((el) => pause.observe(el));
}

/* ---------- scrolling text speed ---------- */
// A steady speed in pixels per second, so long and short lines move the same on every screen.
function setMarquee() {
  const speed = Math.min(120, Math.max(64, innerWidth * 0.18));
  $$('.mq div').forEach((d) => {
    const dur = d.scrollWidth / 2 / speed;
    const now = parseFloat(d.style.animationDuration) || 0;
    if (!now || Math.abs(now - dur) / dur > 0.1) d.style.animationDuration = dur.toFixed(1) + 's';
  });
}
setMarquee();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(setMarquee);

/* ---------- 30 nights grid (home) ---------- */
const grid = $('#ngrid');
const tiles = [];
if (grid) {
  const stops = [[11, 31, 158], [20, 54, 216], [42, 116, 255], [98, 184, 255], [169, 216, 255], [215, 240, 255]];
  for (let i = 0; i < 30; i++) {
    const t = (i / 29) * (stops.length - 1), a = Math.floor(t), b = Math.min(stops.length - 1, a + 1), f = t - a;
    const col = stops[a].map((v, k) => Math.round(v + (stops[b][k] - v) * f));
    const el = document.createElement('i');
    el.style.backgroundColor = 'rgb(' + col.join(',') + ')';
    grid.appendChild(el); tiles.push(el);
  }
  // Egg: night 30. Tap the last night in the grid.
  tiles[29].addEventListener('click', () => { tiles[29].classList.add('got'); findEgg('night30'); });
}
const ncount = $('#ncount'), nsec = $('#nights');
let lastNight = -1;
function night() {
  if (!grid || !ncount || !nsec) return;
  const r = nsec.getBoundingClientRect(), h = innerHeight;
  if (r.top > h) return;
  const p = (h * 0.82 - r.top) / (Math.min(r.height, h) * 0.8);
  const n = Math.max(1, Math.min(30, Math.ceil(p * 30)));
  if (n === lastNight) return;
  lastNight = n;
  tiles.forEach((t, i) => t.classList.toggle('off', i >= n));
  ncount.textContent = String(n);
}

/* ---------- sticky buy bar (shop) ---------- */
const stick = $('#stick'), buyrow = $('#buyrow');
function buybar() { if (stick && buyrow) stick.classList.toggle('on', buyrow.getBoundingClientRect().bottom < 0); }

/* ---------- floating capsules (home) ---------- */
// The capsules ease toward the scroll position, so they glide instead of snapping with it.
const caps = $$('[data-float]');
let capY = window.scrollY || 0, capRaf = 0;
function capStep() {
  const target = window.scrollY || 0;
  capY += (target - capY) * 0.16;
  if (Math.abs(target - capY) < 0.4) capY = target;
  caps.forEach((c) => {
    const d = parseFloat(c.getAttribute('data-float'));
    c.style.transform = 'translate3d(0,' + (-capY * d).toFixed(1) + 'px,0) rotate(' + (capY * d * 0.12).toFixed(2) + 'deg)';
  });
  capRaf = capY !== target ? requestAnimationFrame(capStep) : 0;
}
function float() {
  ticking = false;
  buybar();
  night();
  popScroll();
  if (reduce || !caps.length) return;
  if (!capRaf) capRaf = requestAnimationFrame(capStep);
}
let ticking = false;
window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(float); } }, { passive: true });

codeBar();
paint();
paintBuilder();
float();
