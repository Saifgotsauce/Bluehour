// The capsule menu for "Build your pouch". Used by the shop page, the cart and checkout (server side too).
// Every item is from OK Capsule's formulary. Before launch, have a pharmacist or formulator
// confirm the menu, the per-capsule doses and the max counts below.
// max = the most of one capsule allowed in a pouch. One pouch is one day, so each max keeps that nutrient at or under
// the NIH's adult upper limit for supplements: magnesium 350 mg (2 x 133 = 266), vitamin C 2,000 mg (2 x 1,000),
// zinc 40 mg (1 x 25). Vitamin B12 has no upper limit (NIH), and stays at 1 capsule (1,000 mcg).
// Glycine, NAC, the probiotic and ginger have no official upper limit. Glycine goes to 3 (2,550 mg; studies use 3 g),
// NAC to 2 (1,200 mg; studies commonly use up to 1,800 mg a day). The probiotic stays at its 1-capsule label serving, and ginger at 1 (500 mg).
// min = the fewest of a capsule every pouch must have. Glycine is at least 2 in every pouch (founder's rule: it's the
// ingredient people feel). cleanMix enforces min and max, in the browser and again in api/checkout.js.
// signature = how many The Signature (the default pouch) has. It fills all 8 slots.
// facts = Supplement Facts rows per capsule [nutrient, amount, % Daily Value], copied from OK Capsule. other = other ingredients. warn = label warnings beyond 'keep out of reach of children'.
// \u2020 means no Daily Value is established.
// SIGNATURE_NAME is what the default pouch is called everywhere on the site.

import { PREORDER } from './preorder.js';

// PRICE is the launch price of one roll. During pre-order it's shown crossed out next to the founding price.
export const PRICE = 129;
export const MAX_CAPS = 8;
export const SIGNATURE_NAME = 'The Signature';

// Crew pricing: the more rolls in one order, the less each roll costs. Every roll in the cart counts,
// even when the rolls have different pouches, so friends can order together.
export const LAUNCH_TIERS = [
  { rolls: 1, each: 129, name: '' },
  { rolls: 2, each: 119, name: 'Duo' },
  { rolls: 3, each: 109, name: 'Crew' },
];
// Founding prices, for pre-orders only (see preorder.js).
export const PREORDER_TIERS = [
  { rolls: 1, each: 99, name: '' },
  { rolls: 2, each: 94, name: 'Duo' },
  { rolls: 3, each: 89, name: 'Crew' },
];
export const TIERS = PREORDER ? PREORDER_TIERS : LAUNCH_TIERS;
export const tierFor = (rolls) => TIERS.filter((t) => rolls >= t.rolls).pop() || TIERS[0];
export const eachFor = (rolls) => tierFor(rolls).each;
export const totalFor = (rolls) => rolls * eachFor(rolls);
// The crossed-out price for one roll. Normally the single-roll price. During pre-order it's the launch price for the
// same number of rolls (3 rolls compare with $109 each, not $129), so the savings shown are never overstated.
export const refEachFor = (rolls) =>
  PREORDER ? (LAUNCH_TIERS.filter((t) => rolls >= t.rolls).pop() || LAUNCH_TIERS[0]).each : PRICE;
export const savingFor = (rolls) => rolls * refEachFor(rolls) - totalFor(rolls);
export const nextTier = (rolls) => TIERS.find((t) => t.rolls > rolls) || null;
export const perNight = (each) => '$' + (each / 30).toFixed(2);

export const INGREDIENTS = [
  {
    id: 'level', name: 'Level', ingredient: 'Magnesium', dose: '133 mg', blurb: 'Magnesium glycinate. Helps support normal muscle and nerve function.*', img: 'cap-still', max: 2, signature: 2,
    facts: [['Magnesium (as magnesium glycinate, 20% magnesium)', '133 mg', '32%']],
    other: 'Hypromellose (vegetable capsule), microcrystalline cellulose, magnesium stearate, silica, stearic acid.',
    coa: { file: '/coa/magnesium-glycinate-eurofins-4201639.pdf', label: '133 mg', got: '142 mg', lab: 'Eurofins', date: 'Aug 2023', lot: '061523126', found: '142 mg of magnesium per capsule (label: 133 mg)', micro: 'No E. coli, Salmonella or Staph found. Bacteria, yeast and mold counts low.' },
  },
  {
    id: 'bright', name: 'Bright', ingredient: 'Vitamin C', dose: '1,000 mg', blurb: 'An antioxidant that helps support normal immune function.*', img: 'cap-bright', max: 1, signature: 1,
    facts: [['Vitamin C (as ascorbic acid)', '1,000 mg', '1111%']],
    other: 'Hypromellose (capsule), magnesium stearate, silica.',
    coa: { file: '/coa/vitamin-c-1000mg-intertek-112724-1718.pdf', label: '1,000 mg', got: '1,082 mg', lab: 'Intertek', date: 'Dec 2024', lot: '100224127', found: '1,082 mg of vitamin C per capsule (label: 1,000 mg)', micro: 'No E. coli, Salmonella or Staph found. Yeast and mold under 10 per gram, bacteria well within limits.' },
  },
  {
    // Spark was a methyl B-complex until Nov 2026. Swapped for B12 alone: no niacin (flush, over the US limit on paper)
    // and no B6 (nerve-risk warnings in the EU, Australia and Canada). TODO: add Other ingredients and the lab report (CoA)
    // from OK Capsule's B12 listing; until then the shop shows "Lab report for this capsule coming soon."
    id: 'spark', name: 'Spark', ingredient: 'Vitamin B12', dose: '1,000 mcg', blurb: 'Vitamin B12 as methylcobalamin. Helps support normal energy metabolism.*', img: 'cap-steady', max: 1, signature: 1,
    facts: [['Vitamin B12 (as methylcobalamin)', '1,000 mcg', '41667%']],
  },
  {
    id: 'core', name: 'Core', ingredient: 'Zinc', dose: '25 mg', blurb: 'An essential mineral that helps support normal immune function.*', img: 'cap-guard', max: 1, signature: 1,
    facts: [['Zinc', '25 mg', '227%']],
    other: 'Vegetable capsule, rice flour.',
    coa: { file: '/coa/zinc-25mg-intertek-041725-1156.pdf', label: '25 mg', got: '25.9 mg', lab: 'Intertek', date: 'Apr 2025', lot: 'M250067', found: '25.9 mg of zinc per capsule (label: 25 mg)', micro: 'No E. coli, Salmonella or Staph found. Bacteria, yeast and mold all under 10 per gram.' },
  },
  {
    id: 'glow', name: 'Glow', ingredient: 'Glycine', dose: '850 mg', blurb: 'An amino acid your body uses to build proteins, including collagen.*', img: 'cap-glycine', max: 3, min: 2, signature: 2,
    facts: [['L-glycine', '850 mg', '\u2020']],
    other: 'Hypromellose (capsule).',
    coa: { file: '/coa/glycine-850mg-intertek-062425-1465.pdf', label: '850 mg', got: '857 mg', lab: 'Intertek', date: 'Jul 2025', lot: '233791', found: '857 mg of glycine per capsule (label: 850 mg)', micro: 'No E. coli, Salmonella or Staph found. Bacteria, yeast and mold all under 10 per gram.' },
  },
  {
    id: 'prime', name: 'Prime', ingredient: 'NAC', dose: '600 mg', blurb: 'A form of the amino acid cysteine that your body uses to make the antioxidant glutathione.*', img: 'cap-nac', max: 2, signature: 1,
    facts: [['N-acetyl cysteine', '600 mg', '\u2020']],
    other: 'Hypromellose (natural vegetable capsule), rice (Oryza sativa cera) bran, magnesium stearate, silica.',
    // Lab report (CoA) from OK Capsule's catalog. Link the whole PDF: Eurofins doesn't allow publishing part of it.
    coa: { file: '/coa/nac-600mg-eurofins-4388554.pdf', label: '600 mg', got: '639 mg', lab: 'Eurofins', date: 'Feb 2024', lot: '112123126', found: '639 mg of NAC per capsule (label: 600 mg)', micro: 'No E. coli, Salmonella or Staph found. Yeast, mold and bacteria counts within limits.' },
  },
  {
    id: 'culture', name: 'Culture', ingredient: '10B probiotic', dose: '10 billion cultures', blurb: '10 billion live cultures from 10 strains, plus inulin, to help support normal digestive health.*', img: 'cap-probiotic', max: 1, signature: 0,
    facts: [
      ['Inulin / fructooligosaccharides', '100 mg', '\u2020'],
      ['Proprietary blend: Lactobacillus casei, L. paracasei, L. acidophilus, L. bulgaricus, Bifidobacterium bifidum, L. rhamnosus, L. brevis, L. plantarum, L. salivarius, B. lactis', '39 mg', '\u2020'],
    ],
    warn: 'Discontinue use and consult your physician if any adverse conditions occur. If you are pregnant, nursing, taking medication, have a medical condition, or are under medical supervision, consult your healthcare professional before use.',
    other: 'Cellulose, dicalcium phosphate, silica, magnesium stearate (vegetable).',
    coa: { file: '/coa/probiotic-10b-intertek-082025-1261.pdf', label: '10 billion a capsule (minimum)', got: '50 billion', gotUnit: 'per gram', lab: 'Intertek', date: 'Aug 2025', lot: '300-00057323', found: '50 billion live cultures per gram, against a minimum of 10 billion per capsule', micro: 'No E. coli, Salmonella or Staph found. Yeast and mold under 10 per gram.' },
  },
  {
    // Ginger: optional only, never in the signature pouch. Keep its wording plain: no nausea, stomach-settling or
    // morning-after language, because next to a nights-out brand that reads as a hangover claim (see FDA's 2020
    // hangover warning letters). Max 1 (500 mg). Ginger may add to the effect of blood thinners; the medication FAQ covers that.
    id: 'root', name: 'Root', ingredient: 'Ginger root', dose: '500 mg', blurb: 'Organic ginger root, the same spice you cook with, in a capsule.', img: 'cap-ginger', max: 1, signature: 0,
    facts: [['Organic ginger root (Zingiber officinale)', '500 mg', '\u2020']],
    other: 'Vegetable cellulose.',
  },
];

// Capsules with no published lab report yet. Every "lab tested" line on the site reads this, so the claim stays true
// (docs/CLAIMS.md). Add the CoA to the capsule above and it drops off this list.
export const LAB_PENDING = INGREDIENTS.filter((i) => !i.coa).map((i) => `${i.name} (${i.ingredient})`);
export const labPendingText = () => LAB_PENDING.length ? LAB_PENDING.join(' and ') : '';

export const SIGNATURE = Object.fromEntries(INGREDIENTS.filter((i) => i.signature).map((i) => [i.id, i.signature]));

// Blue Hour packs on /build: ready-made pouches to start from (docs/FUNNEL.md). Named for occasions, never for a
// condition (no "hangover", "recovery" or "detox" packs). Every pack must pass cleanMix unchanged: 2+ glycine,
// within each capsule's max, 8 capsules at most. Have a pharmacist look over each one before relying on them.
export const PACKS = [
  { id: 'signature', name: 'The Signature', tag: 'Our default', line: 'The full eight. Magnesium, glycine, NAC, vitamin C, zinc and B12.',
    mix: { level: 2, glow: 2, prime: 1, bright: 1, core: 1, spark: 1 } },
  { id: 'lights-out', name: 'Lights Out', tag: 'Extra glycine', line: 'For the nights you get home latest: three glycine, two magnesium, plus vitamin C, zinc and B12.',
    mix: { glow: 3, level: 2, bright: 1, core: 1, spark: 1 } },
  { id: 'long-weekend', name: 'Long Weekend', tag: 'Festivals and travel', line: 'For multi-day weekends away: swaps NAC and B12 for a probiotic and ginger.',
    mix: { glow: 2, level: 2, bright: 1, core: 1, culture: 1, root: 1 } },
  { id: 'basics', name: 'The Basics', tag: 'No NAC', line: 'The essentials without NAC: magnesium, glycine, vitamin C, zinc and B12. Seven capsules.',
    mix: { glow: 2, level: 2, bright: 1, core: 1, spark: 1 } },
];

// A pouch as a short link, for saved packs and reorders: /build?mix=level-2.glow-2.prime-1
export const mixParam = (mix) => INGREDIENTS.filter((i) => mix[i.id]).map((i) => `${i.id}-${mix[i.id]}`).join('.');
export const mixFromParam = (str) => {
  const out = {};
  String(str || '').split('.').forEach((p) => {
    const m = p.match(/^([a-z]+)-(\d)$/);
    if (m && INGREDIENTS.some((i) => i.id === m[1])) out[m[1]] = +m[2];
  });
  return out;
};

// Keeps only known capsules, within each capsule's min, max and the pouch limit.
// Minimums are filled first (glycine x2), then everything else in menu order until the pouch is full.
export function cleanMix(mix) {
  const out = {};
  let left = MAX_CAPS;
  const want = (i) => Math.max(0, parseInt((mix && mix[i.id]) || 0, 10) || 0);
  for (const i of INGREDIENTS) {
    if (!i.min) continue;
    const n = Math.min(i.max, left, Math.max(i.min, want(i)));
    if (n > 0) { out[i.id] = n; left -= n; }
  }
  for (const i of INGREDIENTS) {
    if (i.min) continue;
    const n = Math.min(i.max, left, want(i));
    if (n > 0) { out[i.id] = n; left -= n; }
  }
  return out;
}
export const minFor = (id) => (INGREDIENTS.find((i) => i.id === id) || {}).min || 0;

export const mixTotal = (mix) => Object.values(mix).reduce((a, b) => a + b, 0);
export const mixKey = (mix) => INGREDIENTS.filter((i) => mix[i.id]).map((i) => i.id + mix[i.id]).join('-');
export const isSignature = (mix) => mixKey(mix) === mixKey(SIGNATURE);
export const mixSummary = (mix) =>
  INGREDIENTS.filter((i) => mix[i.id]).map((i) => i.name + (mix[i.id] > 1 ? ' ×' + mix[i.id] : '')).join(', ');

// Ingredient names for the cart, so shoppers see exactly what they're paying for.
export const packSummary = (mix) =>
  INGREDIENTS.filter((i) => mix[i.id]).map((i) => i.ingredient + (mix[i.id] > 1 ? ' \u00d7' + mix[i.id] : '')).join(', ');
