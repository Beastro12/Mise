/**
 * The colour of each ingredient as it looks on the plate. Drives the recipe
 * "plate" illustrations so a week of meals reads as food, not text.
 */
const COLORS: Record<string, string> = {
  // fish & meat
  lohi: "#f08a5d",
  kirjolohi: "#ee8f67",
  turska: "#f3ece0",
  seiti: "#efe6d6",
  katkarapu: "#f4a07a",
  tonnikala: "#c9876c",
  jauheliha: "#8a4a36",
  naudanliha: "#7b3b2b",
  porsaanliha: "#d59a7e",
  pekoni: "#c2574a",
  kinkku: "#e79a93",
  makkara: "#b0553c",
  broilerinfilee: "#e9c79d",
  "broilerin suikale": "#e8c294",
  "kanan koipireisi": "#d9a36a",
  kananmuna: "#f4c542",
  // roots & veg
  peruna: "#e6c46f",
  bataatti: "#e07b39",
  porkkana: "#ee7a2a",
  lanttu: "#e8b24b",
  punajuuri: "#8e1f45",
  palsternakka: "#efe1bd",
  sipuli: "#ecd9b0",
  punasipuli: "#8c3a66",
  valkosipuli: "#f1e8d2",
  purjo: "#b7cc84",
  tomaatti: "#d9412b",
  kirsikkatomaatti: "#e0452f",
  tomaattimurska: "#c23a26",
  tomaattipyree: "#a92f20",
  paprika: "#d83b2a",
  chili: "#c8281e",
  kurkku: "#6f9a4a",
  kesäkurpitsa: "#7ea34f",
  parsakaali: "#3f7a3a",
  kukkakaali: "#efe8d4",
  pinaatti: "#3e6b2f",
  pakastepinaatti: "#3e6b2f",
  kaali: "#c8d99c",
  herkkusieni: "#c9ad8a",
  kantarelli: "#e3a02f",
  herne: "#7fb04a",
  maissi: "#f2c94c",
  avokado: "#8aa84a",
  // herbs (drawn as sprinkles)
  tilli: "#5f9a3a",
  persilja: "#4f8a2f",
  korianteri: "#5b9a3f",
  basilika: "#4d8a36",
  ruohosipuli: "#5e9c45",
  // dairy & grains
  kerma: "#f7f0de",
  kuohukerma: "#f8f2e3",
  ruokakerma: "#f5eedc",
  kermaviili: "#f7f3e8",
  smetana: "#f7f3e8",
  ranskankerma: "#f6efdf",
  maito: "#f8f5ec",
  juusto: "#f1c65b",
  parmesaani: "#ecd48b",
  feta: "#f5f1e6",
  mozzarella: "#f7f3ea",
  voi: "#f6dc7a",
  riisi: "#f7f2e6",
  pasta: "#efd28a",
  kikherne: "#d9b26b",
  linssi: "#c96f3b",
  kookosmaito: "#f5efe2",
  currytahna: "#c9532b",
  curry: "#d9a032",
  ruisleipä: "#5a3a24",
  leipä: "#c89456",
  tortilla: "#e9cf98",
  // berries & fruit
  puolukka: "#b3263e",
  mustikka: "#3a3f78",
  mansikka: "#d7263d",
  vadelma: "#c7325a",
  omena: "#b7c95a",
  sitruuna: "#f2d64b",
  limetti: "#8fbf45",
};

const HERBS = new Set(["tilli", "persilja", "korianteri", "basilika", "ruohosipuli"]);

/** Fallback colour per shopping section. */
const SECTION_COLORS: Record<string, string> = {
  hedelmat_vihannekset: "#7fa34f",
  leipa: "#c89456",
  liha_kala: "#c9735a",
  maito_juusto: "#f3ead3",
  kuivatuotteet: "#d8b777",
  pakasteet: "#9cc0cf",
  juomat: "#9b3b4a",
  muut: "#cdbfa6",
};

/** Seasonings and liquids that don't show on the plate. */
const INVISIBLE = new Set([
  "suola", "mustapippuri", "rypsiöljy", "oliiviöljy", "vesi", "sokeri", "vehnäjauho", "perunajauho",
  "kasvisliemi", "kanaliemi", "lihaliemi", "kalaliemi", "laakerinlehti", "maustepippuri", "paprikajauhe",
  "juustokumina", "kurkuma", "kaneli", "oregano", "timjami", "garam masala", "soijakastike", "leivinjauhe",
]);

export function foodColor(nameFi: string, section?: string): string {
  const n = nameFi.toLowerCase();
  if (COLORS[n]) return COLORS[n];
  for (const [k, v] of Object.entries(COLORS)) if (n.includes(k)) return v;
  return SECTION_COLORS[section ?? "muut"] ?? SECTION_COLORS.muut;
}

export type PlateSpec = { base: string; pieces: string[]; herbs: string[] };

/**
 * Build a plate from a recipe's ingredients: the first substantial ingredient
 * is the base (soup, sauce, rice), the next few become pieces, herbs sprinkle.
 */
export function plateFor(ingredients: Array<{ nameFi: string; category: string }>): PlateSpec {
  const visible = ingredients.filter((i) => !INVISIBLE.has(i.nameFi));
  const herbs = visible.filter((i) => HERBS.has(i.nameFi)).map((i) => foodColor(i.nameFi));
  const solid = visible.filter((i) => !HERBS.has(i.nameFi));
  // Plate background: a coloured sauce first (curry, tomato), then a creamy
  // or starchy base, else the first ingredient. Cream alone reads as "empty".
  const pick = (re: RegExp) => solid.find((i) => re.test(i.nameFi));
  const base =
    pick(/currytahna|tomaattimurska|tomaattipyree|curry|punajuuri/) ??
    pick(/kerma|maito|kookosmaito|viili|smetana|riisi|pasta/) ??
    solid[0];
  const rest = solid.filter((i) => i !== base);
  let baseColor = base ? foodColor(base.nameFi, base.category) : "#efe3c8";
  // Cream sauces and soups take on the colour of what's cooked in them.
  if (base && /kerma|maito|viili|smetana/.test(base.nameFi)) {
    const star = solid.find((i) => i.category === "liha_kala") ?? solid.find((i) => i.category === "hedelmat_vihannekset" && !/sipuli|peruna/.test(i.nameFi));
    if (star) baseColor = mix(baseColor, foodColor(star.nameFi, star.category), 0.38);
  }
  return {
    base: baseColor,
    pieces: rest.filter((i) => !/kerma|maito|viili|smetana|kookosmaito/.test(i.nameFi)).slice(0, 5).map((i) => foodColor(i.nameFi, i.category)),
    herbs,
  };
}

/** Dominant (most characteristic) colour of a recipe, for tinting cards. */
export function accentFor(ingredients: Array<{ nameFi: string; category: string }>): string {
  const meatFish = ingredients.find((i) => i.category === "liha_kala");
  const veg = ingredients.find((i) => i.category === "hedelmat_vihannekset" && !INVISIBLE.has(i.nameFi) && !HERBS.has(i.nameFi) && i.nameFi !== "sipuli");
  const pick = meatFish ?? veg ?? ingredients.find((i) => !INVISIBLE.has(i.nameFi));
  return pick ? foodColor(pick.nameFi, pick.category) : "#e3a02f";
}

function mix(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return "#" + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, "0")).join("");
}
