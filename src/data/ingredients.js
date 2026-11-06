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

export const PRICE = 129;
export const MAX_CAPS = 6;

export const INGREDIENTS = [
  {
    id: 'level', name: 'Level', ingredient: 'Magnesium', dose: '133 mg', blurb: 'Magnesium glycinate. Helps support normal muscle and nerve function.*', img: 'cap-still', max: 2, signature: 2,
    facts: [['Magnesium (as magnesium glycinate, 20% magnesium)', '133 mg', '32%']],
    other: 'Hypromellose (vegetable capsule), microcrystalline cellulose, magnesium stearate, silica, stearic acid.',
  },
  {
    id: 'bright', name: 'Bright', ingredient: 'Vitamin C', dose: '1,000 mg', blurb: 'An antioxidant that helps support normal immune function.*', img: 'cap-bright', max: 2, signature: 1,
    facts: [['Vitamin C (as ascorbic acid)', '1,000 mg', '1111%']],
    other: 'Hypromellose (capsule), magnesium stearate, silica.',
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
  },
  {
    id: 'core', name: 'Core', ingredient: 'Zinc', dose: '25 mg', blurb: 'An essential mineral that helps support normal immune function.*', img: 'cap-guard', max: 1, signature: 1,
    facts: [['Zinc', '25 mg', '227%']],
    other: 'Vegetable capsule, rice flour.',
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
  },
  {
    id: 'culture', name: 'Culture', ingredient: '10B probiotic', dose: '10 billion cultures', blurb: '10 billion live cultures from 10 strains, plus inulin, to help support normal digestive health.*', img: 'cap-probiotic', max: 1, signature: 0,
    facts: [
      ['Inulin / fructooligosaccharides', '100 mg', '\u2020'],
      ['Proprietary blend: Lactobacillus casei, L. paracasei, L. acidophilus, L. bulgaricus, Bifidobacterium bifidum, L. rhamnosus, L. brevis, L. plantarum, L. salivarius, B. lactis', '39 mg', '\u2020'],
    ],
    warn: 'Discontinue use and consult your physician if any adverse conditions occur. If you are pregnant, nursing, taking medication, have a medical condition, or are under medical supervision, consult your healthcare professional before use.',
    other: 'Cellulose, dicalcium phosphate, silica, magnesium stearate (vegetable).',
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
