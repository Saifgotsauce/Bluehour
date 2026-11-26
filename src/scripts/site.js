// Blue Hour site behaviour: cart, menu, carousels, buy bar and the small animations.
// Every block checks that its elements exist, because each page only has some of them.

import { EGGS, eggById, inBlueHour, COLLECTOR_NEEDS } from '../data/eggs.js';
import { FOUNDING } from '../data/preorder.js';
import { PRICE, MAX_CAPS, INGREDIENTS, SIGNATURE, SIGNATURE_NAME, PACKS, mixParam, mixFromParam, minFor, cleanMix, mixTotal, mixKey, isSignature, mixSummary, packSummary, eachFor, totalFor, savingFor, nextTier, refEachFor } from '../data/ingredients.js';
import { track, keepRecording, watchSections, attribution, touchString, liveVariants, aid, pageType, visitNumber } from './track.js';
import { signal, state, freshVisit, faqKind } from './state.js';


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
    if (FOUNDING && !(c && c.crew)) return null; // during the founding offer only Founding Crew codes work
    if (c && c.code && Date.now() - c.at < CODE_DAYS * 864e5) return c;
  } catch (e) { /* ignore */ }
  return null;
}
function setCode(c) {
  if (c && c.code) {
    const had = getCode();
    store.set('bh-code', JSON.stringify({ code: c.code, label: c.label || 'Discount', crew: !!c.crew, at: c.at || Date.now(), checked: Date.now() }));
    if (!had || had.code !== c.code) track('code_applied', { crew: !!c.crew });
  }
  else store.set('bh-code', '');
  codeBar(); paint();
  try { window.dispatchEvent(new CustomEvent('bh:code')); } catch (e) { /* ignore */ }
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
const usable = (d) => d && d.valid && (!FOUNDING || d.crew);
(function readCodeFromLink() {
  let url;
  try { url = new URL(location.href); } catch (e) { return; }
  const key = ['code', 'promo', 'discount'].find((k) => url.searchParams.get(k));
  if (key) {
    const code = url.searchParams.get(key).trim();
    url.searchParams.delete(key);
    try { history.replaceState(history.state, '', url.pathname + url.search + url.hash); } catch (e) { /* ignore */ }
    checkPromo(code).then((d) => { if (usable(d)) setCode({ code: d.code, label: d.label, crew: d.crew }); });
    return;
  }
  // Re-check a saved code now and then, in case it was switched off in Stripe.
  const c = getCode();
  if (c && Date.now() - (c.checked || 0) > 6 * 36e5) {
    checkPromo(c.code).then((d) => { if (usable(d)) setCode({ ...c, label: d.label, crew: d.crew }); else if (d.valid === false) setCode(null); });
  }
})();

/* ---------- easter eggs ---------- */
// Hidden discounts (see src/data/eggs.js). Finding one asks /api/egg for a signed token, kept in this
// browser for 48 hours and sent with the order. Checkout applies the best single discount the shopper has.
function eggStore() {
  try { return JSON.parse(store.get('bh-eggs') || '{}') || {}; } catch (e) { return {}; }
}
function liveEggs() {
  if (FOUNDING) return []; // eggs are off during the founding offer
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
  if (FOUNDING) return;
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
  const imgs = ['cap-still', 'cap-bright', 'cap-steady', 'cap-guard', 'cap-glycine', 'cap-nac', 'cap-probiotic', 'cap-ginger'];
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

function addToCart(mix, qty, quiet, from) {
  const clean = cleanMix(mix);
  if (!mixTotal(clean)) return;
  const line = cart.find((l) => mixKey(l.mix) === mixKey(clean));
  if (line) line.qty = Math.min(9, line.qty + qty);
  else cart.push({ mix: clean, qty });
  save(); paint();
  const kind = isSignature(clean) ? 'signature' : 'custom';
  if (kind === 'custom') track('build_completed', { count: mixTotal(clean) });
  track('add_to_cart', { rolls: qty, kind, value: qty * eachFor(cartCount()), from: from || pageType });
  keepRecording('add_to_cart');
  signal('add');
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
    box.innerHTML = '<div class="empty"><h3>Your cart is empty.</h3><p>' + (FOUNDING ? 'Founding price for the first 100 orders.' : 'Your next 30 nights are one tap away.') + '</p><a class="btn solid" href="/shop">' + 'Shop 30 nights' + '</a></div>';
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
    (each < refEachFor(n) ? '<s>' + money(l.qty * refEachFor(n)) + '</s> ' : '') + money(l.qty * each) +
    '</div></div><button class="trash" data-rm="' + i + '">Remove</button></div></div>'
  ).join('');
  const code = getCode(), egg = bestEgg(), cl = $('#codeline');
  cl.hidden = !code && !egg;
  cl.innerHTML =
    (egg ? '<span><b>' + esc(egg.name) + '</b> egg · $' + egg.amount + ' off</span>' : '') +
    (code ? '<span><b>' + esc(code.code) + '</b> · ' + esc(code.label) + ' <button data-dropcode>Remove</button></span>' : '') +
    '<small>' + (code && egg ? 'Only your best discount applies at checkout.' : 'Applied at checkout.') + '</small>';
}

const codeform = $('#codeform');
if (codeform) {
  codeform.addEventListener('submit', async (e) => {
    e.preventDefault();
    const inp = $('#codein'), out = $('#codemsg'), v = inp.value.trim();
    if (!v) return;
    out.textContent = 'Checking...';
    const d = await checkPromo(v);
    if (usable(d)) { setCode({ code: d.code, label: d.label, crew: d.crew }); inp.value = ''; out.textContent = ''; }
    else out.textContent = FOUNDING ? "That isn't a Founding Crew code. Check the spelling with whoever gave it to you." : "That code isn't working. Check the spelling, or it may have ended.";
  });
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
      const d = +q.getAttribute('data-d');
      l.qty = Math.min(9, l.qty + d);
      if (d > 0) track('add_to_cart', { rolls: 1, kind: isSignature(l.mix) ? 'signature' : 'custom', from: 'cart' });
      else track('remove_from_cart', { rolls: 1 });
      if (l.qty < 1) cart.splice(cart.indexOf(l), 1);
    } else if (rm) {
      const gone = cart[+rm.getAttribute('data-rm')];
      track('remove_from_cart', { rolls: gone ? gone.qty : 1 });
      cart.splice(+rm.getAttribute('data-rm'), 1);
    } else return;
    if (!cart.length) signal('add', true);
    save(); paint();
  });
}

/* ---------- build your pouch (shop) ---------- */
const build = $('#build');
function paintBuilder() {
  const t = mixTotal(current);
  $$('[data-add], [data-buy]').forEach((b) => { b.disabled = t === 0; });
  const sum = $('#mixsum');
  const pk = PACKS.find((p) => mixKey(cleanMix(p.mix)) === mixKey(current));
  if (sum) sum.textContent = t === 0 ? 'Pick at least one capsule.' : (pk ? pk.name + ': ' : 'Your custom ' + t + ': ') + mixSummary(current);
  if (!build) return;
  $$('.icard', build).forEach((card) => {
    const id = card.getAttribute('data-id'), max = +card.getAttribute('data-max'), n = current[id] || 0;
    $('[data-n]', card).textContent = String(n);
    card.classList.toggle('on', n > 0);
    $('[data-inc]', card).disabled = n >= max || t >= MAX_CAPS;
    $('[data-dec]', card).disabled = n <= minFor(id);
  });
  const imgs = [];
  INGREDIENTS.forEach((i) => { for (let k = 0; k < (current[i.id] || 0); k++) imgs.push(i.img); });
  $$('#slots i').forEach((slot, k) => {
    slot.classList.toggle('on', k < imgs.length);
    slot.innerHTML = k < imgs.length ? '<img src="/images/' + imgs[k] + '.webp" alt="">' : '';
  });
  const tally = $('#tally');
  if (tally) tally.textContent = t + ' of ' + MAX_CAPS;
  $$('.pack', build).forEach((b) => { b.classList.toggle('on', mixKey(cleanMix(JSON.parse(b.getAttribute('data-mix')))) === mixKey(current)); });
}
// Builder tracking and the "builder hesitator" rule (report 6.4): lots of changes or a long time in the builder
// without adding to cart gets one plain offer of The Signature, once per visit. Never a countdown or pressure.
let buildStart = 0, buildChanges = 0, nudged = false;
function saveBuild() {
  // A custom pouch is kept in this browser, so it's still there next visit (the "saved progress" idea).
  if (isSignature(current)) store.set('bh-build', '');
  else store.set('bh-build', JSON.stringify(current));
}
function builderNudge() {
  if (nudged || isSignature(current) || !build) return;
  const slow = buildStart && Date.now() - buildStart > 45e3;
  if (buildChanges < 6 && !slow) return;
  try { if (sessionStorage.getItem('bh-bnudge')) return; sessionStorage.setItem('bh-bnudge', '1'); } catch (e) { /* ignore */ }
  nudged = true;
  const box = $('#bnudge');
  if (!box) return;
  box.hidden = false;
  track('nudge_shown', { cta: 'builder_signature' });
}
if (build) {
  build.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    if (t.closest('#reset, [data-use-signature]')) {
      current = { ...SIGNATURE }; paintBuilder(); saveBuild();
      track('builder_change', { action: 'reset', count: mixTotal(current) });
      if (t.closest('[data-use-signature]')) { track('nudge_click', { cta: t.closest('#bsaved') ? 'saved_build' : 'builder_signature' }); $$('#bnudge, #bsaved').forEach((n) => { n.hidden = true; }); }
      return;
    }
    const pk = t.closest('[data-pack]');
    if (pk) {
      current = cleanMix(JSON.parse(pk.getAttribute('data-mix')));
      paintBuilder(); saveBuild();
      track('builder_change', { action: 'pack', from: pk.getAttribute('data-pack'), count: mixTotal(current) });
      if (!buildStart) { buildStart = Date.now(); track('build_started', { from: pageType }); signal('build'); }
      const tray = $('.tray', build); if (tray) tray.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const sp = t.closest('[data-load], [data-del]');
    if (sp) {
      const list = loadPacks(), i = +sp.getAttribute('data-load') || +sp.getAttribute('data-del') || 0;
      const item = list[Math.abs(i) - 1];
      if (item && sp.hasAttribute('data-load')) { current = cleanMix(item.mix); paintBuilder(); saveBuild(); track('builder_change', { action: 'load_saved', count: mixTotal(current) }); }
      if (item && sp.hasAttribute('data-del')) { list.splice(Math.abs(i) - 1, 1); savePacks(list); paintPacks(); }
      return;
    }
    const card = t.closest('.icard');
    if (!card) return;
    const id = card.getAttribute('data-id');
    let action = '';
    if (t.closest('[data-inc]')) { current = cleanMix({ ...current, [id]: (current[id] || 0) + 1 }); action = 'add'; }
    else if (t.closest('[data-dec]')) { current = cleanMix({ ...current, [id]: (current[id] || 0) - 1 }); action = 'remove'; }
    else return;
    if (!buildStart) { buildStart = Date.now(); track('build_started', { from: pageType }); signal('build'); }
    buildChanges++;
    // Coarse on purpose: which capsule was picked isn't sent anywhere (privacy policy: capsule picks aren't used for ads).
    track('builder_change', { action, count: mixTotal(current) });
    paintBuilder(); saveBuild(); builderNudge();
  });
  // A pouch link (/build?mix=level-2.glow-2...) from a reorder link, a saved-pouch email or a share wins.
  const fromUrl = cleanMix(mixFromParam(new URLSearchParams(location.search).get('mix')));
  if (mixTotal(fromUrl) && new URLSearchParams(location.search).get('mix')) {
    current = fromUrl;
    track('nudge_shown', { cta: 'pouch_link' });
  } else try {
    const saved = JSON.parse(store.get('bh-build') || 'null');
    if (saved && mixTotal(cleanMix(saved)) && !isSignature(cleanMix(saved))) {
      current = cleanMix(saved);
      const note = $('#bsaved');
      if (note) note.hidden = false;
      track('nudge_shown', { cta: 'saved_build' });
    }
  } catch (e) { /* ignore */ }
}

const lock = (on) => { document.documentElement.style.overflow = on ? 'hidden' : ''; };
function openCart() {
  const c = $('#cart'); if (!c) return;
  $('#chknote').hidden = true;
  track('view_cart', { rolls: cartCount(), value: totalFor(cartCount()) });
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
  if (t.closest('[data-cart]')) { if (t.closest('[data-cta]')) track('nudge_click', { cta: t.closest('[data-cta]').getAttribute('data-cta') }); openCart(); return; }
  if (t.closest('[data-menu]')) { openMenu(); return; }
  const buy = t.closest('[data-buy]');
  if (buy) { if (!buy.disabled) { addToCart(current, picked, true, 'buy_now'); goCheckout(buy); } return; }
  if (t.closest('[data-add]')) { addToCart(current, picked, false, t.closest('#build') ? 'builder' : pageType); return; }
  if (t.closest('#upsell')) { addToCart(SIGNATURE, 1, true, 'cart_upsell'); return; }
  const cta = t.closest('[data-cta]');
  if (cta) { const c = cta.getAttribute('data-cta'); track(c === 'hero' ? 'hero_cta_click' : 'cta_click', { cta: c, page_type: pageType }); }
  const lab = t.closest('a[href^="/coa/"]');
  if (lab) { track('open_lab_report', { report: lab.getAttribute('href').replace(/^\/coa\//, '').replace(/[-_]\d[\w-]*\.pdf$|\.pdf$/, '') }); signal('proof'); }
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
// Trybe visitor ID: the creator click ID saved on landing (30 days), else the cookie the Trybe pixel sets.
const TRYBE_STORE = '0b12d37f-be96-4dc4-bb93-52a7160c6598';
function trybeVid() {
  try {
    const s = JSON.parse(localStorage.getItem('bh-trybe') || 'null');
    if (s && s.v && Date.now() - s.at < 30 * 864e5) return s.v;
  } catch (e) { /* storage blocked */ }
  const m = document.cookie.match(new RegExp('(?:^|; )ugc_vid_' + TRYBE_STORE + '=([^;]+)'));
  if (m) { try { return decodeURIComponent(m[1]); } catch (e) { return m[1]; } }
  return '';
}
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
    const rolls = cartCount();
    track('begin_checkout', { rolls, value: totalFor(rolls), crew: !!(code && code.crew) });
    keepRecording('begin_checkout');
    store.set('bh-pending', JSON.stringify({ rolls, value: totalFor(rolls), at: Date.now() }));
    store.set('bh-lastorder', JSON.stringify(cart.map((l) => ({ mix: l.mix, qty: l.qty }))));
    const r = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lines: cart, code: code ? code.code : '', egg: (bestEgg() || {}).token || '', vid: trybeVid(),
        // Where this buyer came from, saved on the Stripe order (see api/checkout.js).
        attr: { first: touchString(attribution.first), last: touchString(attribution.last), aid, exp: liveVariants() },
      }),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok && d.url) { flushSoon(); location.href = d.url; return; }
    track('checkout_error', { error: d.error || ('http_' + r.status) });
    if (d.error === 'not_configured') msg = "Checkout isn't switched on yet. Please check back soon.";
    if (d.error === 'founding_full') msg = 'All 100 founding orders are taken. We\'re switching to launch prices now. Please try again shortly.';
  } catch (e) { track('checkout_error', { error: 'network' }); }
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
$$('[data-qty]').forEach((el) => el.addEventListener('change', () => {
  setPicked(parseInt(el.value, 10));
  track('quantity_selected', { qty: picked, value: totalFor(picked) });
  signal('price');
}));

// A page can start on a different roll count (e.g. /festival starts on the 3-roll crew price).
{ const c = $('[data-qty][type="radio"]:checked'); if (c && +c.value !== picked) setPicked(+c.value); }
// Pack switch inside a segment page's buy box (/festival: The Signature or Long Weekend).
$$('[data-offer-pack]').forEach((b) => b.addEventListener('click', () => {
  const p = PACKS.find((x) => x.id === b.getAttribute('data-offer-pack'));
  if (!p) return;
  current = cleanMix(p.mix); paintBuilder();
  $$('[data-offer-pack]').forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
  const link = $('#offer [data-cta="offer_build"]');
  if (link) link.setAttribute('href', '/build?mix=' + mixParam(current));
  track('builder_change', { action: 'pack', from: p.id, count: mixTotal(current) });
}));

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

/* ---------- product gallery ---------- */
// Swipe, arrows or thumbnails. The next photo peeks in on phones, and the first time someone lands on the page
// the photos slide a little to show they move.
$$('[data-gal]').forEach((gal) => {
  const tr = $('.track', gal), figs = [...tr.children], thumbs = $$('[data-gto]', gal);
  const curEl = $('[data-gcur]', gal), prev = $('[data-gprev]', gal), next = $('[data-gnext]', gal);
  let cur = 0;
  const at = () => {
    const x = tr.scrollLeft + 4;
    let i = 0;
    figs.forEach((f, k) => { if (f.offsetLeft - figs[0].offsetLeft <= x) i = k; });
    if (tr.scrollLeft + tr.clientWidth >= tr.scrollWidth - 4) i = figs.length - 1;
    return i;
  };
  const mark = () => {
    curEl.textContent = cur + 1;
    thumbs.forEach((b, k) => { if (k === cur) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
    const t = thumbs[cur];
    if (t) t.parentElement.scrollTo({ left: t.offsetLeft - t.parentElement.clientWidth / 2 + t.clientWidth / 2, behavior: reduce ? 'auto' : 'smooth' });
    if (prev) prev.disabled = cur === 0;
    if (next) next.disabled = cur === figs.length - 1;
  };
  const go = (i) => {
    i = Math.max(0, Math.min(figs.length - 1, i));
    tr.scrollTo({ left: figs[i].offsetLeft - figs[0].offsetLeft, behavior: reduce ? 'auto' : 'smooth' });
  };
  tr.addEventListener('scroll', () => { const i = at(); if (i !== cur) { cur = i; mark(); } }, { passive: true });
  thumbs.forEach((b) => b.addEventListener('click', () => go(+b.dataset.gto)));
  if (prev) prev.addEventListener('click', () => go(cur - 1));
  if (next) next.addEventListener('click', () => go(cur + 1));
  tr.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(cur + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(cur - 1); }
  });
  mark();
  // One small nudge per visit, only on touch screens and only if they haven't touched it yet.
  let touched = false;
  ['pointerdown', 'touchstart', 'wheel'].forEach((ev) => tr.addEventListener(ev, () => { touched = true; }, { passive: true }));
  const seen = store.get('bh-gal-nudge');
  if (!reduce && !seen && matchMedia('(hover: none)').matches) {
    setTimeout(() => {
      if (touched || tr.scrollLeft > 0) return;
      store.set('bh-gal-nudge', '1');
      tr.style.scrollSnapType = 'none';
      tr.scrollTo({ left: 70, behavior: 'smooth' });
      setTimeout(() => { tr.scrollTo({ left: 0, behavior: 'smooth' }); setTimeout(() => { tr.style.scrollSnapType = ''; }, 600); }, 650);
    }, 1400);
  }
});

/* ---------- saved packs (browser only, "bh-packs") ---------- */
function loadPacks() { try { const l = JSON.parse(store.get('bh-packs') || '[]'); return Array.isArray(l) ? l.slice(0, 12) : []; } catch (e) { return []; } }
function savePacks(l) { store.set('bh-packs', JSON.stringify(l.slice(0, 12))); }
// auto = saved by us (emailed pouch, a past order), not named by the visitor: if they already saved the
// same pouch under their own name, keep their name.
function addPack(name, mix, auto) {
  const clean = cleanMix(mix);
  if (!mixTotal(clean)) return false;
  const all = loadPacks(), same = all.find((p) => mixKey(cleanMix(p.mix)) === mixKey(clean));
  if (auto && same) name = same.name;
  const l = all.filter((p) => p !== same);
  l.unshift({ name: String(name || 'My pouch').replace(/[<>]/g, '').slice(0, 24), mix: clean, at: Date.now() });
  savePacks(l);
  return true;
}
function paintPacks() {
  const box = $('#mypacks'), ul = $('#packlist');
  if (!box || !ul) return;
  const l = loadPacks();
  box.hidden = !l.length;
  ul.innerHTML = '';
  l.forEach((p, i) => {
    const li = document.createElement('li');
    const sp = document.createElement('span'); sp.textContent = p.name + ' · ' + mixTotal(cleanMix(p.mix));
    const ld = document.createElement('button'); ld.type = 'button'; ld.setAttribute('data-load', String(i + 1)); ld.textContent = 'Use';
    const dl = document.createElement('button'); dl.type = 'button'; dl.setAttribute('data-del', String(i + 1)); dl.textContent = 'Remove';
    li.append(sp, ld, dl); ul.append(li);
  });
}
const savepack = $('#savepack');
if (savepack) savepack.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $('#packname').value.trim() || 'My pouch';
  const ok = addPack(name, current);
  $('#savemsg').textContent = ok ? 'Saved. It\'s in "Your saved packs" next time, on this phone.' : 'Pick at least one capsule first.';
  if (ok) { $('#packname').value = ''; paintPacks(); track('pack_saved', { count: mixTotal(current) }); }
});
paintPacks();

/* ---------- FAQ accordion ---------- */
const faqSeen = new Set();
function faqOpened(d) {
  const q = (($('.q', d) || $('summary', d) || {}).textContent || '').trim();
  const topic = q.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
  if (!topic || faqSeen.has(topic)) return;
  faqSeen.add(topic);
  track('faq_open', { topic });
  signal(faqKind(q));
}
// FAQs that open without the animation (reduced motion), and Supplement Facts panels.
document.addEventListener('toggle', (e) => {
  const d = e.target;
  if (!(d instanceof HTMLDetailsElement) || !d.open) return;
  if (d.classList.contains('facts')) { track('view_supplement_facts', { page_type: pageType }); signal('proof'); }
  else if (d.closest('.faq')) faqOpened(d);
}, true);
// Quick, light open and close: only the answer's height and opacity move.
const FAQ_EASE = 'cubic-bezier(.2,.8,.2,1)';
$$('.faq details').forEach((d) => {
  const sum = $('summary', d), body = $('p', d);
  if (!sum || !body || reduce || !body.animate) return;
  let anim = null;
  sum.addEventListener('click', (e) => {
    e.preventDefault();
    if (anim) anim.cancel();
    if (!d.open) faqOpened(d);
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
async function subscribe(email, when, source, event, link) {
  try {
    const r = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, when, source, event, link }),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok && d.ok) {
      store.set('bh-sub', '1');
      track('newsletter_opt_in', { form: source });
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

// Builder: "Not ready? Email yourself this pouch." Sends the pouch link to Klaviyo (property saved_link).
$$('.mailpouch').forEach((f) => {
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const note = $('.formnote', f), input = $('input', f), btn = $('button', f);
    if (btn.disabled) return;
    btn.disabled = true;
    const r = await subscribe(input.value, '', 'build', '', '/build?mix=' + mixParam(current));
    btn.disabled = false;
    if (r.ok) { input.value = ''; note.textContent = 'Sent to your inbox. Your pouch is saved in the link.'; addPack('Emailed pouch', current, true); paintPacks(); }
    else note.textContent = subError(r.error);
  });
});

// Event pouch page (/tried): email for the founding offer and a reminder before the next night out.
$$('.triedform').forEach((f) => {
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const note = $('.formnote', f.parentNode), input = $('input', f), btn = $('button', f);
    if (btn.disabled) return;
    btn.disabled = true;
    const r = await subscribe(input.value, '', 'event', f.getAttribute('data-event') || '');
    btn.disabled = false;
    if (r.ok) { input.value = ''; note.textContent = 'Done. Check your inbox.'; }
    else note.textContent = subError(r.error);
  });
});

$$('.foot .form').forEach((f) => {
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const note = $('.formnote', f.parentNode), input = $('input', f), btn = $('button', f);
    if (btn.disabled) return;
    if (isPlur(input.value)) { input.value = ''; findEgg('plur'); return; }
    btn.disabled = true;
    const r = await subscribe(input.value, '', 'footer');
    btn.disabled = false;
    if (r.ok) { input.value = ''; note.textContent = 'You\'re in. See you in your inbox.'; }
    else note.textContent = subError(r.error);
  });
});

// Late-night visitors (docs/MARKETING-FUNNEL.md): on a phone between 11pm and 5am, someone browsing in bed
// isn't going to type a card number. Offer one tap instead: "send me this tomorrow". It saves the page they
// were on to Klaviyo (saved_link) and a flow emails it the next morning. Shows once a day at most, never to
// people already signed up, and it switches off the welcome popup for this visit so they never get both.
(function tomorrowBar() {
  const PAGES = ['home', 'shop', 'build', 'up_early', 'festival', 'advertorial'];
  if (!PAGES.includes(pageType) || store.get('bh-sub')) return;
  const h = new Date().getHours();
  if (!(h >= 23 || h < 5)) return;
  if (!matchMedia('(max-width: 760px)').matches) return;
  if (Date.now() - (+store.get('bh-tmr') || 0) < 864e5) return;
  let shown = false;
  const link = () => (pageType === 'build' ? '/build?mix=' + mixParam(current) : location.pathname.replace(/\/$/, '') || '/');
  function show() {
    if (shown || $('#cart.on, #menu.on, .wpop')) return;
    shown = true;
    removeEventListener('scroll', onScroll);
    store.set('bh-tmr', String(Date.now()));
    try { sessionStorage.setItem('bh-pop', '1'); } catch (e) { /* ignore */ }
    popArmed = false;
    const bar = document.createElement('div');
    bar.className = 'tmr';
    bar.setAttribute('role', 'dialog');
    bar.setAttribute('aria-label', 'Send me this tomorrow');
    bar.innerHTML =
      '<button class="tmr-x" type="button" aria-label="Close"><svg viewBox="0 0 24 24"><use href="#i-x"/></svg></button>' +
      '<p class="tmr-t"><b>Up late?</b> We\'ll email you this page in the morning.</p>' +
      '<form class="tmr-f" novalidate><label for="tmr-em" class="sr">Email address</label><input id="tmr-em" type="email" placeholder="Email address" autocomplete="email"><button type="submit">Send it</button></form>' +
      '<p class="tmr-n" role="status"></p>';
    document.body.append(bar);
    const lift = () => {
      const s = $('.stick.on, .astick.on');
      bar.style.bottom = 'calc(' + ((s ? s.getBoundingClientRect().height : 0) + 10) + 'px + env(safe-area-inset-bottom,0px))';
    };
    lift();
    addEventListener('scroll', lift, { passive: true });
    const hide = () => { bar.classList.remove('on'); removeEventListener('scroll', lift); setTimeout(() => bar.remove(), 700); };
    $('.tmr-x', bar).addEventListener('click', () => { track('nudge_click', { cta: 'tomorrow_close' }); hide(); });
    $('form', bar).addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('button', e.target), input = $('input', e.target), note = $('.tmr-n', bar);
      if (btn.disabled) return;
      btn.disabled = true;
      const r = await subscribe(input.value, '', 'tomorrow', '', link());
      btn.disabled = false;
      if (r.ok) { e.target.remove(); $('.tmr-t', bar).innerHTML = '<b>Done.</b> It\'ll be in your inbox in the morning. Get some sleep.'; setTimeout(hide, 4000); }
      else note.textContent = subError(r.error);
    });
    track('nudge_shown', { cta: 'tomorrow' });
    requestAnimationFrame(() => requestAnimationFrame(() => bar.classList.add('on')));
  }
  function onScroll() {
    const max = document.documentElement.scrollHeight - innerHeight;
    if (max > 300 && scrollY / max > 0.4) show();
  }
  setTimeout(show, 20000);
  addEventListener('scroll', onScroll, { passive: true });
})();

const OFFER_LOCK = 864e5; // 24 hours
const POP_SKIP = /^\/(thank-you|welcome|privacy|terms|refunds|shipping|contact)/;
const WHENS = [['this-weekend', 'This weekend'], ['this-month', 'This month'], ['later', 'Later this year'], ['every-weekend', 'Every weekend']];
function popAllowed() {
  if (POP_SKIP.test(location.pathname) || store.get('bh-sub') || getCode()) return false;
  // Once the offer has been shown (or the Journal bar closed), it stays away on this browser for 24 hours.
  if (Date.now() - (+store.get('bh-pop') || 0) < OFFER_LOCK) return false;
  try { if (sessionStorage.getItem('bh-pop')) return false; } catch (e) { /* ignore */ }
  return true;
}
// When it shows: on the homepage, shop and other pages, the full sign-up opens after 6 seconds or once
// someone scrolls about one screen. On Journal pages, where people arrive from Google to read, a slim bar
// appears instead (after 8 seconds or a quarter of the way down) and opens the full sign-up only when tapped.
// On desktop, heading for the tab bar to leave opens the full sign-up on any page.
const IS_JOURNAL = /^\/blog(\/|$)/.test(location.pathname);
// The welcome offer is off during the founding offer: codes don't apply, and the founding price is the deal.
let popArmed = !FOUNDING && popAllowed();
function tryPop(full) {
  if (!popArmed) return;
  if ($('#cart.on, #menu.on, .wpop')) { setTimeout(() => tryPop(full), 6000); return; }
  popArmed = false;
  fetch('/api/subscribe').then((r) => r.json()).then((d) => {
    if (d.on) (IS_JOURNAL && !full ? openPopBar : openPop)();
  }).catch(() => {});
}
function openPopBar() {
  try { sessionStorage.setItem('bh-pop', '1'); } catch (e) { /* ignore */ }
  const bar = document.createElement('div');
  bar.className = 'popbar';
  bar.innerHTML =
    '<button class="popbar-open" type="button"><span class="popbar-tag">10% off</span><span class="popbar-t">Your first roll. Tap for the code</span>' +
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
    '<button class="popbar-x" type="button" aria-label="Close"><svg viewBox="0 0 24 24"><use href="#i-x"/></svg></button>';
  document.body.append(bar);
  const hide = () => { bar.classList.remove('on'); setTimeout(() => bar.remove(), 700); };
  $('.popbar-x', bar).addEventListener('click', () => { store.set('bh-pop', String(Date.now())); hide(); });
  $('.popbar-open', bar).addEventListener('click', () => { hide(); openPop(); });
  requestAnimationFrame(() => requestAnimationFrame(() => bar.classList.add('on')));
}
function openPop() {
  try { sessionStorage.setItem('bh-pop', '1'); } catch (e) { /* ignore */ }
  // The offer only lasts while this is open: the 24-hour lock starts now, unless they sign up.
  store.set('bh-pop', String(Date.now()));
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
    '<p class="eyebrow">Welcome offer</p><h2 id="poph">10% off your first roll.</h2><p class="popurgent"><span></span>Only while this is open. Close it and this offer won\'t come back on this browser for 24 hours.</p></div>' +
    '<form class="popbody" novalidate><p class="popq">When\'s your next big night?</p>' +
    '<div class="popchips" role="radiogroup" aria-label="When\'s your next big night?">' +
    WHENS.map(([v, t]) => '<button type="button" role="radio" aria-checked="false" data-when="' + v + '">' + t + '</button>').join('') +
    '</div><p class="pophint" hidden>Heads up: rolls are packed to order and arrive in 5 to 9 days.</p>' +
    '<div class="form"><label for="popem" class="sr">Email address</label><input id="popem" type="email" placeholder="Email address" autocomplete="email"><button type="submit">Get 10% off</button></div>' +
    '<p class="fine">We\'ll nudge you to order in time for it. By joining you agree to get marketing emails from Blue Hour. Unsubscribe anytime. <a href="/privacy">Privacy</a></p>' +
    '<p class="formnote" role="status"></p></form>';
  document.body.append(scrim, pop);
  let when = '';
  const close = (done) => {
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
  setTimeout(() => tryPop(false), IS_JOURNAL ? 8000 : 6000);
  document.addEventListener('mouseout', (e) => { if (!e.relatedTarget && e.clientY <= 0) tryPop(true); });
}
function popScroll() {
  if (!popArmed) return;
  if (IS_JOURNAL) {
    const h = document.documentElement.scrollHeight - innerHeight;
    if (h > 400 && scrollY / h > 0.25) tryPop(false);
  } else if (scrollY > innerHeight * 0.85) tryPop(false);
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
// Shows whenever the main buy buttons are off screen, including on first load when they're further down,
// so there's always a buy button in reach on a phone. On desktop it only shows after you scroll past them.
function buybar() {
  if (!stick || !buyrow) return;
  const r = buyrow.getBoundingClientRect();
  stick.classList.toggle('on', r.bottom < 0 || (innerWidth < 900 && r.top > innerHeight - 40));
}
buybar(); addEventListener('resize', buybar, { passive: true });

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

/* ---------- tracking: page-level events and visitor-state responses ---------- */
function flushSoon() { try { dispatchEvent(new Event('pagehide')); } catch (e) { /* ignore */ } }
watchSections((name) => {
  // Seeing how it works or what's in the box counts as getting to know the product.
  if (/^(nights|inbox|signature|pull_tear_sleep|how|build|ingredients|tested|monday|festival_steps|offer)/.test(name)) signal('product');
});
if (pageType === 'shop') { track('view_item', { value: eachFor(1), page_type: 'shop' }); signal('product'); }
// Purchase: Stripe sends buyers to /thank-you?session_id=... (Stripe stays the record of what was paid).
(function purchase() {
  if (pageType !== 'thank_you') return;
  const sidp = new URLSearchParams(location.search).get('session_id');
  if (!sidp || store.get('bh-tx') === sidp) return;
  let pend = {};
  try { pend = JSON.parse(store.get('bh-pending') || '{}') || {}; } catch (e) { /* ignore */ }
  track('purchase', { tx: sidp.slice(-12), rolls: pend.rolls, value: pend.value });
  // Reorder links: each pouch from this order becomes a saved pack and a /build?mix=... link.
  try {
    const lines = JSON.parse(store.get('bh-lastorder') || '[]');
    const ul = $('#reorderlist');
    lines.forEach((l, i) => {
      const mix = cleanMix(l.mix);
      if (!mixTotal(mix)) return;
      addPack(isSignature(mix) ? SIGNATURE_NAME : 'Your order ' + (i + 1), mix, true);
      if (ul) { const li = document.createElement('li'); const a = document.createElement('a'); a.href = '/build?mix=' + mixParam(mix); const pk = PACKS.find((x) => mixKey(cleanMix(x.mix)) === mixKey(mix)); a.textContent = (pk ? pk.name : 'Your custom pouch') + ': ' + mixSummary(mix); li.append(a); ul.append(li); }
    });
    if (ul && ul.children.length) $('#reorder').hidden = false;
  } catch (e) { /* ignore */ }
  keepRecording('purchase');
  store.set('bh-tx', sidp); store.set('bh-pending', '');
  signal('purchase');
})();
// Cart holder coming back on a new visit (report 5.2): one quiet reminder that their roll is still saved.
// No countdown, no "almost gone". Not shown if a code message is already in the top bar.
(function cartReminder() {
  if (!freshVisit || !cartCount() || pageType === 'thank_you' || getCode() || bestEgg()) return;
  const bar = $('.promo');
  if (!bar) return;
  bar.classList.add('coded');
  bar.innerHTML = 'Your ' + (cartCount() > 1 ? cartCount() + ' rolls are' : 'roll is') + ' still in your cart' +
    (FOUNDING ? ', at the founding price.' : '.') + ' <button type="button" data-cart data-cta="cart_reminder">Open cart</button>';
  track('nudge_shown', { cta: 'cart_reminder' });
})();
// Founding counter (docs/FUNNEL.md): real paid orders from Stripe, shown only to warm visitors (been here before,
// came in with a code, or already looking at the product closely), and only once there are enough orders to count.
(function foundingCounter() {
  const els = $$('[data-founding]');
  if (!els.length || !FOUNDING) return;
  const warm = visitNumber > 1 || !!getCode() || state() !== 'cold' && state() !== 'curious';
  if (!warm) return;
  fetch('/api/founding').then((r) => r.json()).then((d) => {
    if (!d || !d.show) return;
    els.forEach((el) => { el.textContent = d.claimed + ' of ' + d.cap + ' founding orders claimed. ' + d.left + ' left at the founding price.'; el.hidden = false; });
    track('nudge_shown', { cta: 'founding_counter' });
  }).catch(() => {});
})();
// Home: if they built a custom pouch on an earlier visit, say it's saved.
(function savedChip() {
  const chip = $('#savedchip');
  if (!chip) return;
  try {
    const saved = JSON.parse(store.get('bh-build') || 'null');
    if (saved && mixTotal(cleanMix(saved)) && !isSignature(cleanMix(saved))) { chip.hidden = false; track('nudge_shown', { cta: 'saved_build_home' }); }
  } catch (e) { /* ignore */ }
})();
