// Visitor states (report section 5.2) and the rules that respond to them (report section 6.4).
//
// The idea borrowed from MONOPOLY GO!: watch what each visitor does, work out what they need next, and hand them
// that one thing. Here that means a handful of plain rules, not a black-box score (report 4.3: no prediction
// models on tiny data). Every rule is written down in docs/TRACKING.md.
//
// States, highest first. A visitor is in the first one that fits:
//   buyer             paid (thank-you page reached with a Stripe session)
//   cart_holder       added a roll, hasn't paid
//   configurator      started building a custom pouch
//   price_evaluator   changed the number of rolls, or opened a price, shipping or pre-order question
//   proof_seeker      opened Supplement Facts, a lab report, or a safety or medication question
//   curious           saw how it works or the product
//   cold              nothing yet
//
// Signals are counted in this browser only (localStorage "bh-sig"). Nothing here is about health: we never
// infer conditions, medication, drinking or anything else from behaviour (report 6.3).

import { track, tag, isNewSession } from './track.js';

const KEY = 'bh-sig';
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } };
const write = (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* storage blocked */ } };
let sig = read();

export const ORDER = ['buyer', 'cart_holder', 'configurator', 'price_evaluator', 'proof_seeker', 'curious', 'cold'];

export function stateOf(s = sig) {
  if (s.purchase) return 'buyer';
  if (s.add && !s.purchase) return 'cart_holder';
  if (s.build) return 'configurator';
  if (s.price) return 'price_evaluator';
  if (s.proof) return 'proof_seeker';
  if (s.product) return 'curious';
  return 'cold';
}

let current = stateOf();
document.documentElement.dataset.state = current;
tag('state', current);

// Record a signal. Kinds: product, proof, price, build, add, purchase. Returns the (maybe new) state.
export function signal(kind, clear) {
  if (clear) delete sig[kind];
  else sig[kind] = (sig[kind] || 0) + 1;
  if (kind === 'purchase') delete sig.add; // after paying they're a buyer, not a cart holder
  write(sig);
  const next = stateOf();
  if (next !== current) {
    track('state_change', { from: current, state: next });
    current = next;
    document.documentElement.dataset.state = next;
    tag('state', next);
  }
  return next;
}
export const state = () => current;
export const freshVisit = isNewSession;

// FAQ questions are sorted into the state they signal by their wording.
export function faqKind(q) {
  const t = q.toLowerCase();
  if (/(cost|price|\$|charged|ship|cancel|refund|subscription|discount|smaller size|30 nights|country)/.test(t)) return 'price';
  if (/(tested|medication|right for me|cure|5-htp|made|safe|nac|what's in)/.test(t)) return 'proof';
  return 'product';
}
