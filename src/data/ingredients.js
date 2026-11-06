// The capsule menu for "Build your pouch". Used by the shop page and the cart.
// Every item is from OK Capsule's formulary. Before launch, have a pharmacist or formulator
// confirm the menu, the per-capsule doses and the max counts below.
// max = the most of one capsule allowed in a pouch. signature = how many the default pouch has.
// facts = Supplement Facts rows per capsule [nutrient, amount, % Daily Value], copied from OK Capsule. other = other ingredients.

export const PRICE = 129;
export const MAX_CAPS = 6;

export const INGREDIENTS = [
  { id: 'level', name: 'Level', ingredient: 'Magnesium', dose: '', blurb: 'Helps support normal muscle and nerve function.*', img: 'cap-still', max: 2, signature: 2 },
  { id: 'bright', name: 'Bright', ingredient: 'Vitamin C', dose: '1,000 mg', blurb: 'An antioxidant that helps support normal immune function.*', img: 'cap-bright', max: 1, signature: 1 },
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
    other: 'Microcrystalline cellulose, vegetable capsule (hypromellose), MCT 70% C8/C10 coconut on acacia (GoMCT).',
  },
  { id: 'core', name: 'Core', ingredient: 'Zinc', dose: '25 mg', blurb: 'An essential mineral that helps support normal immune function.*', img: 'cap-guard', max: 1, signature: 1 },
  { id: 'glow', name: 'Glow', ingredient: 'Glycine', dose: '', blurb: 'An amino acid your body uses to build proteins, including collagen.*', img: 'cap-glycine', max: 1, signature: 1 },
  { id: 'prime', name: 'Prime', ingredient: 'NAC', dose: '600 mg', blurb: 'A form of the amino acid cysteine that your body uses to make the antioxidant glutathione.*', img: 'cap-nac', max: 1, signature: 0 },
  { id: 'culture', name: 'Culture', ingredient: 'Probiotic', dose: '10 billion CFU', blurb: 'Live cultures that help support normal digestive health.*', img: 'cap-probiotic', max: 1, signature: 0 },
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
