// The capsule menu for "Build your pouch". Used by the shop page and the cart.
// Every item is from OK Capsule's formulary. Before launch, have a pharmacist or formulator
// confirm the menu, the per-capsule doses and the max counts below.
// max = the most of one capsule allowed in a pouch. signature = how many the default pouch has.

export const PRICE = 119;
export const MAX_CAPS = 6;

export const INGREDIENTS = [
  { id: 'level', name: 'Level', ingredient: 'Magnesium', dose: '', blurb: 'Helps support normal muscle and nerve function.*', img: 'cap-still', max: 2, signature: 2 },
  { id: 'bright', name: 'Bright', ingredient: 'Vitamin C', dose: '1,000 mg', blurb: 'An antioxidant that helps support normal immune function.*', img: 'cap-bright', max: 1, signature: 1 },
  { id: 'spark', name: 'Spark', ingredient: 'Methyl B-complex', dose: '', blurb: 'B vitamins that help support normal energy metabolism.*', img: 'cap-steady', max: 1, signature: 1 },
  { id: 'core', name: 'Core', ingredient: 'Zinc', dose: '25 mg', blurb: 'An essential mineral that helps support normal immune function.*', img: 'cap-guard', max: 1, signature: 1 },
  { id: 'clear', name: 'Clear', ingredient: 'L-theanine', dose: '200 mg', blurb: 'An amino acid found naturally in green and black tea.', img: 'cap-hush', max: 1, signature: 1 },
  { id: 'glow', name: 'Glow', ingredient: 'Glycine', dose: '', blurb: 'An amino acid your body uses to build proteins, including collagen.*', img: 'cap-glycine', max: 1, signature: 0 },
  { id: 'prime', name: 'Prime', ingredient: 'NAC', dose: '600 mg', blurb: 'A form of the amino acid cysteine that your body uses to make the antioxidant glutathione.*', img: 'cap-nac', max: 1, signature: 0 },
  { id: 'zest', name: 'Zest', ingredient: 'Ginger root', dose: '', blurb: 'A kitchen classic that helps support digestive comfort.*', img: 'cap-ginger', max: 1, signature: 0 },
  { id: 'flow', name: 'Flow', ingredient: 'Omega-3', dose: '', blurb: 'Fatty acids that help support normal heart and brain health.*', img: 'cap-omega', max: 1, signature: 0 },
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
