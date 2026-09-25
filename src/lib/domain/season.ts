/**
 * Roughly what's in season in Finland each month (domestic harvest or good
 * storage crops). General guidance, not a harvest calendar.
 */
const BY_MONTH: string[][] = [
  /* Jan */ ["lanttu", "punajuuri", "kaali", "porkkana", "peruna", "karpalo"],
  /* Feb */ ["lanttu", "punajuuri", "kaali", "porkkana", "peruna", "sipuli"],
  /* Mar */ ["lanttu", "punajuuri", "porkkana", "peruna", "sipuli", "ruohosipuli"],
  /* Apr */ ["ruohosipuli", "nokkonen", "porkkana", "peruna", "punajuuri"],
  /* May */ ["raparperi", "nokkonen", "ruohosipuli", "tilli", "kurkku"],
  /* Jun */ ["varhaisperuna", "mansikka", "raparperi", "tilli", "kurkku", "herne"],
  /* Jul */ ["mansikka", "mustikka", "herne", "varhaisperuna", "kesäkurpitsa", "tomaatti", "kantarelli"],
  /* Aug */ ["mustikka", "vadelma", "kantarelli", "kukkakaali", "parsakaali", "tomaatti", "kesäkurpitsa"],
  /* Sep */ ["puolukka", "kantarelli", "suppilovahvero", "omena", "lanttu", "punajuuri", "kaali", "porkkana"],
  /* Oct */ ["puolukka", "karpalo", "suppilovahvero", "omena", "lanttu", "kaali", "punajuuri"],
  /* Nov */ ["karpalo", "lanttu", "punajuuri", "kaali", "porkkana", "peruna"],
  /* Dec */ ["karpalo", "lanttu", "punajuuri", "kaali", "porkkana", "peruna"],
];

export const MONTH_FI = ["tammikuu", "helmikuu", "maaliskuu", "huhtikuu", "toukokuu", "kesäkuu", "heinäkuu", "elokuu", "syyskuu", "lokakuu", "marraskuu", "joulukuu"];

export function inSeason(monthIndex: number): string[] {
  return BY_MONTH[((monthIndex % 12) + 12) % 12];
}

/** Recipes using at least one seasonal ingredient, with the matches. */
export function seasonalRecipes<T extends { id: string; ingredients: Array<{ nameFi: string }> }>(recipes: T[], season: string[]) {
  const set = new Set(season);
  return recipes
    .map((r) => ({ recipe: r, uses: [...new Set(r.ingredients.map((i) => i.nameFi).filter((n) => set.has(n) || (n === "herkkusieni" && set.has("kantarelli"))))] }))
    .filter((x) => x.uses.length)
    .sort((a, b) => b.uses.length - a.uses.length);
}
