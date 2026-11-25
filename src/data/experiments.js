// Live experiments (report section 8). Each visitor is put in one variant per live experiment and stays in it.
// The variant is tagged in Clarity (exp_<id>) and saved on every order in Stripe (metadata "experiments"),
// so results come from real orders, not guesses.
//
// Rules:
// - One major change at a time. Don't test the hero, the price and the builder at once.
// - Write the experiment in docs/EXPERIMENTS.md before turning it on: hypothesis, metric, guardrail, end date.
// - Don't call a winner from a handful of orders. Use the sample-size note in docs/EXPERIMENTS.md.
// - To read a variant in a page script: import { variant } from '../scripts/track.js'; variant('id').
//
// Example, switched off:
// { id: 'signature_prime', live: false, variants: ['with_prime', 'without_prime'],
//   note: 'Does NAC in the default pouch change add-to-cart rate?' },
export const EXPERIMENTS = [];
