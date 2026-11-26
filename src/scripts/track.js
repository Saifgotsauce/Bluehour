// Blue Hour behaviour tracking (see docs/TRACKING.md for the event dictionary and docs/OPERATING.md for how it's used).
//
// One function, track(name, params), sends every event to three places:
//   1. Microsoft Clarity: custom events and tags, so recordings and heatmaps can be filtered by what people did
//      ("show me every session with add_to_cart but no begin_checkout").
//   2. window.dataLayer: so Google Analytics 4 or Tag Manager can be added later without touching the site's code.
//      Nothing reads it today.
//   3. /api/t: our own anonymous event log. Data we own, not rented from a tool. See api/t.js.
//
// Privacy rules (report 6.3, privacy policy "Site analytics"):
//   - Never send names, emails, addresses, payment details, free text, health details or the exact capsules picked.
//   - Only the parameter names in ALLOWED get through, and values are cut short.
//   - The visitor ID is a random string made in this browser. It isn't linked to a person.

import { EXPERIMENTS } from '../data/experiments.js';

const ALLOWED = new Set([
  'page_type', 'section', 'cta', 'rolls', 'value', 'kind', 'count', 'action', 'topic', 'report',
  'state', 'from', 'error', 'step', 'tx', 'form', 'crew', 'seconds', 'source', 'qty',
]);
const store = {
  get(k, s = localStorage) { try { return s.getItem(k); } catch (e) { return null; } },
  set(k, v, s = localStorage) { try { s.setItem(k, v); } catch (e) { /* storage blocked */ } },
};
const rid = () => {
  try { return crypto.randomUUID().replace(/-/g, '').slice(0, 20); } catch (e) { return (Date.now().toString(36) + Math.random().toString(36).slice(2)).slice(0, 20); }
};

/* ---------- who (anonymously) and which visit ---------- */
// aid: one per browser. sid: one per visit, a new one after 30 minutes without activity.
export const aid = (() => { let v = store.get('bh-aid'); if (!v) { v = rid(); store.set('bh-aid', v); } return v; })();
const SESSION_GAP = 30 * 60e3;
let newSession = false;
export const sid = (() => {
  let s = null;
  try { s = JSON.parse(store.get('bh-sid') || 'null'); } catch (e) { /* ignore */ }
  if (!s || Date.now() - s.at > SESSION_GAP) { s = { v: rid(), at: Date.now(), n: (s && s.n ? s.n : 0) + 1 }; newSession = true; }
  s.at = Date.now();
  store.set('bh-sid', JSON.stringify(s));
  return s;
})();
export const isNewSession = newSession;
export const visitNumber = sid.n || 1;

/* ---------- where they came from (first touch and last touch) ---------- */
// Saved in this browser and sent with the order to Stripe (api/checkout.js), so every order shows which
// campaign, creator link or site brought the buyer in.
const clean = (v, n = 60) => String(v || '').replace(/[^\w.\-:/ @]/g, '').slice(0, n);
function readTouch() {
  let url;
  try { url = new URL(location.href); } catch (e) { return null; }
  const q = (k) => url.searchParams.get(k) || '';
  let ref = '';
  try { ref = document.referrer ? new URL(document.referrer).hostname : ''; } catch (e) { /* ignore */ }
  if (ref === location.hostname) ref = '';
  const src = q('utm_source') || q('src') || q('ref') || '';
  if (!src && !ref && !q('utm_campaign') && !q('code')) return null; // a click inside the site, not a new arrival
  return {
    src: clean(src || ref || 'direct'), med: clean(q('utm_medium')), camp: clean(q('utm_campaign')),
    content: clean(q('utm_content')), ref: clean(ref), landing: clean(url.pathname, 80), at: Date.now(),
  };
}
export const attribution = (() => {
  let a = {};
  try { a = JSON.parse(store.get('bh-attr') || '{}') || {}; } catch (e) { /* ignore */ }
  const t = readTouch();
  if (t) { if (!a.first) a.first = t; a.last = t; }
  if (!a.first) { a.first = { src: 'direct', med: '', camp: '', content: '', ref: '', landing: clean(location.pathname, 80), at: Date.now() }; a.last = a.first; }
  store.set('bh-attr', JSON.stringify(a));
  return a;
})();
export const touchString = (t) => t ? [t.src, t.med, t.camp, t.content, t.landing].map((x) => x || '-').join('|').slice(0, 300) : '';

/* ---------- experiments ---------- */
// Each visitor gets one variant per live experiment and keeps it. Variants are tagged in Clarity and sent with
// orders, so results can be compared. Define experiments in src/data/experiments.js.
export function variant(id) {
  const ex = EXPERIMENTS.find((e) => e.id === id && e.live);
  if (!ex) return null;
  const key = 'bh-exp-' + id;
  let v = store.get(key);
  if (!v || !ex.variants.includes(v)) {
    v = ex.variants[Math.floor(Math.random() * ex.variants.length)];
    store.set(key, v);
  }
  return v;
}
export const liveVariants = () =>
  EXPERIMENTS.filter((e) => e.live).map((e) => e.id + '=' + variant(e.id)).join(',').slice(0, 300);

/* ---------- sending ---------- */
const clarity = (...a) => { try { if (typeof window.clarity === 'function') window.clarity(...a); } catch (e) { /* ignore */ } };
export const tag = (k, v) => clarity('set', k, String(v).slice(0, 100));
// Clarity only keeps a sample of recordings on busy days. This marks a visit as one to keep (cart, checkout).
export const keepRecording = (why) => clarity('upgrade', why);
window.dataLayer = window.dataLayer || [];

const queue = [];
const URGENT = new Set(['add_to_cart', 'begin_checkout', 'checkout_error', 'purchase', 'crew_application', 'newsletter_opt_in']);
let timer = 0;
function flush() {
  if (!queue.length) return;
  const body = JSON.stringify({ aid, sid: sid.v, events: queue.splice(0, queue.length) });
  try {
    if (navigator.sendBeacon && navigator.sendBeacon('/api/t', new Blob([body], { type: 'application/json' }))) return;
  } catch (e) { /* fall through */ }
  try { fetch('/api/t', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {}); } catch (e) { /* ignore */ }
}
addEventListener('pagehide', flush);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });

export function track(name, params = {}) {
  const p = {};
  Object.keys(params).forEach((k) => {
    if (!ALLOWED.has(k)) return;
    const v = params[k];
    if (v === undefined || v === null || v === '') return;
    p[k] = typeof v === 'number' ? Math.round(v * 100) / 100 : typeof v === 'boolean' ? v : String(v).slice(0, 80);
  });
  clarity('event', name);
  window.dataLayer.push({ event: name, ...p });
  queue.push({ n: name, p, t: Date.now(), path: location.pathname.slice(0, 80) });
  // Money and checkout events go out straight away. Everything else is batched for a couple of seconds.
  if (queue.length >= 12 || URGENT.has(name)) flush();
  else { clearTimeout(timer); timer = setTimeout(flush, 2500); }
}

/* ---------- section views ---------- */
// A section counts as seen when at least half of it is on screen for at least 1 second, once per page view
// (report 6.2). That means "it was probably seen", not "it was read".
export function watchSections(onSeen) {
  if (!('IntersectionObserver' in window)) return;
  const name = (el) => el.dataset.sec || el.id || ((el.querySelector('h1, h2') || {}).textContent || '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
  const seen = new Set(), timers = new Map();
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    const n = name(e.target);
    if (!n || seen.has(n)) return;
    if (e.isIntersecting) {
      timers.set(n, setTimeout(() => { seen.add(n); io.unobserve(e.target); track('section_view', { section: n }); if (onSeen) onSeen(n); }, 1000));
    } else { clearTimeout(timers.get(n)); }
  }), { threshold: 0.5 });
  // Tall sections can never be half on screen on a phone, so they count once 40% of the screen is filled by them.
  const tall = new IntersectionObserver((es) => es.forEach((e) => {
    const n = name(e.target);
    if (!n || seen.has(n)) return;
    const fill = e.intersectionRect.height / innerHeight;
    if (fill >= 0.4) {
      if (!timers.has('t' + n)) timers.set('t' + n, setTimeout(() => { seen.add(n); tall.unobserve(e.target); track('section_view', { section: n }); if (onSeen) onSeen(n); }, 1000));
    } else { clearTimeout(timers.get('t' + n)); timers.delete('t' + n); }
  }), { threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6] });
  document.querySelectorAll('[data-sec], header.hero, header.jhero, section.phero, section.sec, main section').forEach((el) => {
    if (el.getBoundingClientRect().height > innerHeight * 1.6) tall.observe(el); else io.observe(el);
  });
}

/* ---------- page basics ---------- */
const PAGE = location.pathname === '/' ? 'home'
  : /^\/shop/.test(location.pathname) ? 'shop'
  : /^\/learn/.test(location.pathname) ? 'advertorial'
  : /^\/crew/.test(location.pathname) ? 'crew'
  : /^\/blog\/./.test(location.pathname) ? 'journal_post'
  : /^\/blog/.test(location.pathname) ? 'journal'
  : /^\/thank-you/.test(location.pathname) ? 'thank_you'
  : /^\/build/.test(location.pathname) ? 'build'
  : /^\/up-early/.test(location.pathname) ? 'up_early'
  : /^\/festival/.test(location.pathname) ? 'festival'
  : /^\/tried/.test(location.pathname) ? 'tried'
  : 'other';
export const pageType = PAGE;

tag('page_type', PAGE);
tag('source_first', attribution.first ? attribution.first.src : 'direct');
tag('source_last', attribution.last ? attribution.last.src : 'direct');
if (attribution.last && attribution.last.camp) tag('campaign', attribution.last.camp);
tag('visit', visitNumber > 1 ? 'returning' : 'new');
tag('device', matchMedia('(max-width: 899px)').matches ? 'phone' : 'desktop');
EXPERIMENTS.filter((e) => e.live).forEach((e) => tag('exp_' + e.id, variant(e.id)));
track('page_view', { page_type: PAGE, source: attribution.last ? attribution.last.src : 'direct' });
