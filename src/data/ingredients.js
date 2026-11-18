// The capsule menu for "Build your pouch". Used by the shop page and the cart.
// Every item is from OK Capsule's formulary. Before launch, have a pharmacist or formulator
// confirm the menu, the per-capsule doses and the max counts below.
// max = the most of one capsule allowed in a pouch. One pouch is one day, so each max keeps that nutrient at or under
// the NIH's adult upper limit for supplements: magnesium 350 mg (2 x 133 = 266), vitamin C 2,000 mg (2 x 1,000),
// zinc 40 mg (1 x 25). B-complex stays at 1: its 15 mg of flushing-type niacin is under the 30-50 mg where flushing
// starts, but its 75 mg total niacin is over the 35 mg limit on paper, so a pharmacist should sign it off.
// Glycine, NAC and the probiotic have no official upper limit. Glycine goes to 3 (2,550 mg; studies use 3 to 15 g a day),
// NAC to 2 (1,200 mg; studies commonly use up to 1,800 mg a day). The probiotic stays at its 1-capsule label serving.
// signature = how many the default pouch has.
// facts = Supplement Facts rows per capsule [nutrient, amount, % Daily Value], copied from OK Capsule. other = other ingredients. warn = label warnings beyond 'keep out of reach of children'.
// \u2020 means no Daily Value is established.

import { PREORDER } from './preorder.js';

// PRICE is the launch price of one roll. During pre-order it's shown crossed out next to the founding price.
export const PRICE = 129;
export const MAX_CAPS = 6;

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
    coa: { file: '/coa/magnesium-glycinate-eurofins-4201639.pdf', lab: 'Eurofins', date: 'Aug 2023', lot: '061523126', found: '142 mg of magnesium per capsule (label: 133 mg)', micro: 'No E. coli, Salmonella or Staph found. Bacteria, yeast and mold counts low.' },
  },
  {
    id: 'bright', name: 'Bright', ingredient: 'Vitamin C', dose: '1,000 mg', blurb: 'An antioxidant that helps support normal immune function.*', img: 'cap-bright', max: 2, signature: 1,
    facts: [['Vitamin C (as ascorbic acid)', '1,000 mg', '1111%']],
    other: 'Hypromellose (capsule), magnesium stearate, silica.',
    coa: { file: '/coa/vitamin-c-1000mg-intertek-112724-1718.pdf', lab: 'Intertek', date: 'Dec 2024', lot: '100224127', found: '1,082 mg of vitamin C per capsule (label: 1,000 mg)', micro: 'No E. coli, Salmonella or Staph found. Yeast and mold under 10 per gram, bacteria well within limits.' },
  },
  {
    id: 'spark', name: 'Spark', ingredient: 'Methyl B-complex', dose: '8 B vitamins', blurb: 'B vitamins that help support normal energy metabolism.*', img: 'cap-steady', max: 1, signature: 1,
    facts: [
      ['Vitamin B1 (as benfotiamine)', '20 mg', '1667%'],
      ['Vitamin B2 (riboflavin and riboflavin-5-phosphate)', '17 mg', '1308%'],
      ['Vitamin B3 (as niacin)', '15 mg', '94%'],
      ['Vitamin B3 (as niacinamide)', '60 mg', '375%'],
      ['Vitamin B6 (from pyridoxal-5-phosphate)', '10 mg', '500%'],
      ['Folate (as calcium L-5-methyltetrahydrofolate)', '400 mcg DFE', '100%'],
      ['Vitamin B12 (as methylcobalamin)', '500 mcg', '20833%'],
      ['Biotin', '300 mcg', '1000%'],
      ['Pantothenic acid (as D-calcium pantothenate)', '50 mg', '1000%'],
    ],
    warn: 'If you are pregnant or nursing, consult your physician before taking this product.',
    other: 'Microcrystalline cellulose, vegetable capsule (hypromellose), MCT 70% C8/C10 coconut on acacia (GoMCT).',
    coa: { lab: 'New Wave Scientific', date: 'Jun 2026', lot: '32726426', metals: 'No arsenic, cadmium, lead or mercury detected.', micro: 'No E. coli, Salmonella or Staph found. Bacteria, yeast and mold all under 10 per gram.', files: [['Heavy metals report (PDF)', '/coa/methyl-b-complex-newwave-metals-NWS26-131618.pdf'], ['Microbial report (PDF)', '/coa/methyl-b-complex-newwave-micro-NWS26-131618.pdf']] },
  },
  {
    id: 'core', name: 'Core', ingredient: 'Zinc', dose: '25 mg', blurb: 'An essential mineral that helps support normal immune function.*', img: 'cap-guard', max: 1, signature: 1,
    facts: [['Zinc', '25 mg', '227%']],
    other: 'Vegetable capsule, rice flour.',
    coa: { file: '/coa/zinc-25mg-intertek-041725-1156.pdf', lab: 'Intertek', date: 'Apr 2025', lot: 'M250067', found: '25.9 mg of zinc per capsule (label: 25 mg)', micro: 'No E. coli, Salmonella or Staph found. Bacteria, yeast and mold all under 10 per gram.' },
  },
  {
    id: 'glow', name: 'Glow', ingredient: 'Glycine', dose: '850 mg', blurb: 'An amino acid your body uses to build proteins, including collagen.*', img: 'cap-glycine', max: 3, signature: 1,
    facts: [['L-glycine', '850 mg', '\u2020']],
    other: 'Hypromellose (capsule).',
  },
  {
    id: 'prime', name: 'Prime', ingredient: 'NAC', dose: '600 mg', blurb: 'A form of the amino acid cysteine that your body uses to make the antioxidant glutathione.*', img: 'cap-nac', max: 2, signature: 0,
    facts: [['N-acetyl cysteine', '600 mg', '\u2020']],
    other: 'Hypromellose (natural vegetable capsule), rice (Oryza sativa cera) bran, magnesium stearate, silica.',
    // Lab report (CoA) from OK Capsule's catalog. Link the whole PDF: Eurofins doesn't allow publishing part of it.
    coa: { file: '/coa/nac-600mg-eurofins-4388554.pdf', lab: 'Eurofins', date: 'Feb 2024', lot: '112123126', found: '639 mg of NAC per capsule (label: 600 mg)', micro: 'No E. coli, Salmonella or Staph found. Yeast, mold and bacteria counts within limits.' },
  },
  {
    id: 'culture', name: 'Culture', ingredient: '10B probiotic', dose: '10 billion cultures', blurb: '10 billion live cultures from 10 strains, plus inulin, to help support normal digestive health.*', img: 'cap-probiotic', max: 1, signature: 0,
    facts: [
      ['Inulin / fructooligosaccharides', '100 mg', '\u2020'],
      ['Proprietary blend: Lactobacillus casei, L. paracasei, L. acidophilus, L. bulgaricus, Bifidobacterium bifidum, L. rhamnosus, L. brevis, L. plantarum, L. salivarius, B. lactis', '39 mg', '\u2020'],
    ],
    warn: 'Discontinue use and consult your physician if any adverse conditions occur. If you are pregnant, nursing, taking medication, have a medical condition, or are under medical supervision, consult your healthcare professional before use.',
    other: 'Cellulose, dicalcium phosphate, silica, magnesium stearate (vegetable).',
    coa: { file: '/coa/probiotic-10b-intertek-082025-1261.pdf', lab: 'Intertek', date: 'Aug 2025', lot: '300-00057323', found: '50 billion live cultures per gram, against a minimum of 10 billion per capsule', micro: 'No E. coli, Salmonella or Staph found. Yeast and mold under 10 per gram.' },
  },
];

export const SIGNATURE = Object.fromEntries(INGREDIENTS.filter((i) => i.signature).map((i) => [i.id, i.signature]));

// Keeps only known capsules, within each capsule's max and the pouch limit.
export function cleanMix(mix) {
  const out = {};
  let left = MAX_CAPS;
  for (const i of INGREDIENTS) {
    const n = Math.min(i.max, left, Math.max(0, parseInt((mix && mix[i.id]) || 0, 10) || 0));
    if (n > 0) { out[i.id] = n; left -= n; }
  }
  return out;
}

export const mixTotal = (mix) => Object.values(mix).reduce((a, b) => a + b, 0);
export const mixKey = (mix) => INGREDIENTS.filter((i) => mix[i.id]).map((i) => i.id + mix[i.id]).join('-');
export const isSignature = (mix) => mixKey(mix) === mixKey(SIGNATURE);
export const mixSummary = (mix) =>
  INGREDIENTS.filter((i) => mix[i.id]).map((i) => i.name + (mix[i.id] > 1 ? ' ×' + mix[i.id] : '')).join(', ');

// Ingredient names for the cart, so shoppers see exactly what they're paying for.
export const packSummary = (mix) =>
  INGREDIENTS.filter((i) => mix[i.id]).map((i) => i.ingredient + (mix[i.id] > 1 ? ' \u00d7' + mix[i.id] : '')).join(', ');
