// Blue Hour site behaviour: cart, menu, carousels, buy bar and the small animations.
// Every block checks that its elements exist, because each page only has some of them.

const PRICE = 119;
// Set PUBLIC_CHECKOUT_URL in Vercel (Settings > Environment Variables) to your Stripe Payment Link.
const CHECKOUT_URL = import.meta.env.PUBLIC_CHECKOUT_URL || '';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const money = (n) => '$' + n.toFixed(2);
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } },
};
const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- cart ---------- */
let cart = parseInt(store.get('bh-cart') || '0', 10) || 0;
let picked = 1;
const save = () => store.set('bh-cart', String(cart));

function paint() {
  $$('.count').forEach((c) => { c.hidden = !cart; c.textContent = cart; });
  const title = $('#carttitle');
  if (!title) return;
  title.textContent = cart ? 'Cart • ' + cart : 'Cart';
  $('#shipbox').hidden = !cart;
  $('#cft').hidden = !cart;
  $('#checkout').textContent = 'Checkout • ' + money(cart * PRICE);
  const box = $('#citems');
  if (!cart) {
    box.innerHTML = '<div class="empty"><h3>Your cart is empty.</h3><p>Your next 30 nights are one tap away.</p><a class="btn solid" href="/shop">Shop 30 nights</a></div>';
    return;
  }
  box.innerHTML =
    '<div class="line"><img src="/images/flat.webp" alt="" width="82" height="102"><div><h3>Blue Hour nightly pouches</h3><div class="mt">1 roll, 30 nights</div><div class="ctl"><div class="qty"><button id="qm" aria-label="Remove one roll">−</button><span>' +
    cart +
    '</span><button id="qp" aria-label="Add one roll">+</button></div><div class="price">' +
    money(cart * PRICE) +
    '</div></div><button class="trash" id="qx">Remove</button></div></div>';
  $('#qm').onclick = () => { cart = Math.max(0, cart - 1); save(); paint(); };
  $('#qp').onclick = () => { cart = Math.min(9, cart + 1); save(); paint(); };
  $('#qx').onclick = () => { cart = 0; save(); paint(); };
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
  if (t.closest('[data-add]')) { cart = Math.min(9, cart + picked); save(); paint(); openCart(); return; }
  if (t.closest('#menu a, #cart a')) { closeAll(); return; }
  const cap = t.closest('.cap');
  if (cap) { cap.classList.remove('pop'); void cap.offsetWidth; cap.classList.add('pop'); }
});
['#cartx', '#menux', '#scrim'].forEach((s) => { const el = $(s); if (el) el.addEventListener('click', closeAll); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); });
const checkout = $('#checkout');
if (checkout) {
  checkout.addEventListener('click', () => {
    if (CHECKOUT_URL) location.href = CHECKOUT_URL;
    else $('#chknote').hidden = false;
  });
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
      if (!user && r.top < innerHeight && r.bottom > 0) go((cur + 1) % n);
    }, 4200);
  }
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
if ('IntersectionObserver' in window && !reduce) {
  const io = new IntersectionObserver((es) => {
    es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -6% 0px' });
  $$('.rv').forEach((el) => io.observe(el));
} else {
  $$('.rv').forEach((el) => el.classList.add('in'));
}

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
const caps = $$('[data-float]');
function float() {
  ticking = false;
  buybar();
  night();
  if (reduce) return;
  const y = window.scrollY || 0;
  caps.forEach((c) => {
    const d = parseFloat(c.getAttribute('data-float'));
    c.style.transform = 'translate3d(0,' + -y * d + 'px,0) rotate(' + y * d * 0.12 + 'deg)';
  });
}
let ticking = false;
window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(float); } }, { passive: true });

paint();
float();
