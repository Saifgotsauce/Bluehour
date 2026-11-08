// Blue Hour site behaviour: cart, menu, carousels, buy bar and the small animations.
// Every block checks that its elements exist, because each page only has some of them.

import { PRICE, MAX_CAPS, INGREDIENTS, SIGNATURE, cleanMix, mixTotal, mixKey, isSignature, mixSummary } from '../data/ingredients.js';


const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const money = (n) => '$' + n.toFixed(2);
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } },
};
const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

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

function addToCart(mix, qty) {
  const clean = cleanMix(mix);
  if (!mixTotal(clean)) return;
  const line = cart.find((l) => mixKey(l.mix) === mixKey(clean));
  if (line) line.qty = Math.min(9, line.qty + qty);
  else cart.push({ mix: clean, qty });
  save(); paint(); openCart();
}

function paint() {
  const n = cartCount();
  $$('.count').forEach((c) => { c.hidden = !n; c.textContent = n; });
  const title = $('#carttitle');
  if (!title) return;
  title.textContent = n ? 'Cart • ' + n : 'Cart';
  $('#shipbox').hidden = !n;
  $('#cft').hidden = !n;
  $('#checkout').textContent = 'Checkout • ' + money(n * PRICE);
  const box = $('#citems');
  if (!n) {
    box.innerHTML = '<div class="empty"><h3>Your cart is empty.</h3><p>Your next 30 nights are one tap away.</p><a class="btn solid" href="/shop">Shop 30 nights</a></div>';
    return;
  }
  box.innerHTML = cart.map((l, i) =>
    '<div class="line"><img src="/images/flat.webp" alt="" width="82" height="102"><div><h3>' + lineTitle(l.mix) +
    '</h3><div class="mt">' + mixSummary(l.mix) + '</div><div class="mt">30 nights per roll</div><div class="ctl"><div class="qty"><button data-line="' + i +
    '" data-d="-1" aria-label="Remove one roll">−</button><span>' + l.qty + '</span><button data-line="' + i +
    '" data-d="1" aria-label="Add one roll">+</button></div><div class="price">' + money(l.qty * PRICE) +
    '</div></div><button class="trash" data-rm="' + i + '">Remove</button></div></div>'
  ).join('');
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
  $$('[data-add]').forEach((b) => { b.disabled = t === 0; });
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

document.addEventListener('click', (e) => {
  const t = e.target;
  if (!(t instanceof Element)) return;
  if (t.closest('[data-cart]')) { openCart(); return; }
  if (t.closest('[data-menu]')) { openMenu(); return; }
  if (t.closest('[data-add]')) { addToCart(current, picked); return; }
  if (t.closest('#menu a, #cart a')) { closeAll(); return; }
  const cap = t.closest('.cap');
  if (cap) { cap.classList.remove('pop'); void cap.offsetWidth; cap.classList.add('pop'); }
});
['#cartx', '#menux', '#scrim'].forEach((s) => { const el = $(s); if (el) el.addEventListener('click', closeAll); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); });
const checkout = $('#checkout');
// Sends the cart to /api/checkout, which opens Stripe's payment page.
if (checkout) {
  checkout.addEventListener('click', async () => {
    if (!cart.length || checkout.disabled) return;
    const note = $('#chknote');
    note.hidden = true;
    checkout.disabled = true;
    checkout.textContent = 'Opening secure checkout\u2026';
    try {
      const r = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines: cart }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.url) { location.href = d.url; return; }
      note.textContent = d.error === 'not_configured'
        ? "Checkout isn't switched on yet. Please check back soon."
        : "Checkout couldn't open. Check your connection and try again.";
    } catch (e) {
      note.textContent = "Checkout couldn't open. Check your connection and try again.";
    }
    note.hidden = false;
    checkout.disabled = false;
    paint();
  });
  // Coming back from Stripe with the back button: make the button usable again.
  window.addEventListener('pageshow', () => { checkout.disabled = false; paint(); });
}

/* ---------- quantity pickers (shop) ---------- */
$$('[data-qty]').forEach((sel) => {
  sel.addEventListener('change', () => {
    picked = parseInt(sel.value, 10) || 1;
    $$('[data-qty]').forEach((o) => { o.value = String(picked); });
    $$('[data-price]').forEach((p) => { p.textContent = money(picked * PRICE); });
    $$('[data-rolls]').forEach((p) => { p.textContent = picked + (picked > 1 ? ' rolls' : ' roll'); });
  });
});

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
// Answers open and close with the site's easing; one answer is open at a time.
const EASE = 'cubic-bezier(.19,1,.22,1)';
function closeFaq(d) {
  const body = $('p', d);
  if (reduce || !body || !body.animate) { d.open = false; return; }
  d.dataset.busy = '1';
  const a = body.animate([{ height: body.offsetHeight + 'px', opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 450, easing: EASE, fill: 'forwards' });
  a.onfinish = () => { d.open = false; a.cancel(); delete d.dataset.busy; };
}
$$('.faq details').forEach((d) => {
  const sum = $('summary', d), body = $('p', d);
  if (!sum || !body) return;
  sum.addEventListener('click', (e) => {
    e.preventDefault();
    if (d.dataset.busy) return;
    if (d.open) { closeFaq(d); return; }
    $$('.faq details[open]').forEach((o) => { if (o !== d) closeFaq(o); });
    d.open = true;
    if (reduce || !body.animate) return;
    body.animate([{ height: '0px', opacity: 0 }, { height: body.scrollHeight + 'px', opacity: 1 }], { duration: 700, easing: EASE });
  });
});

/* ---------- email sign-up ---------- */
$$('.form').forEach((f) => {
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const note = $('.formnote', f.parentNode);
    if (note) note.textContent = "Sign-ups aren't connected yet. They go live with the store.";
  });
});

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
  $$('.sec h2, .lead, .bhead, .chips, .bign, .fullshot img, .faq details, .why .def, .why p, .tbw, .leftout').forEach((el) => {
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
  if (reduce || !caps.length) return;
  if (!capRaf) capRaf = requestAnimationFrame(capStep);
}
let ticking = false;
window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(float); } }, { passive: true });

paint();
paintBuilder();
float();
