import type { StoreAdapter, StoreProduct } from "./types";

/**
 * MOCK S-kaupat catalogue. Product names are typical Finnish supermarket items;
 * ids, EANs and prices are INVENTED placeholders (not real S-market data).
 * Exists so the mapping UI, pack counts and price comparison can be exercised
 * until a verified S-kaupat adapter is built (see DECISIONS.md D1).
 */
type Row = [id: string, name: string, brand: string | null, pack: number, unit: string, price: number, keywords: string];

const ROWS: Row[] = [
  ["mock-001", "kermaviili 10 %", null, 200, "g", 0.79, "kermaviili sour cream"],
  ["mock-002", "kermaviili 12 %", null, 200, "g", 1.15, "kermaviili"],
  ["mock-003", "ruokakerma 15 %", null, 2, "dl", 0.89, "ruokakerma kerma cooking cream"],
  ["mock-004", "kuohukerma 35 %", null, 2, "dl", 1.49, "kuohukerma kerma cream heavy"],
  ["mock-005", "vispikerma 35 %", null, 2, "dl", 1.09, "kuohukerma vispikerma kerma"],
  ["mock-006", "ruokakerma laktoositon 15 %", null, 2, "dl", 1.19, "ruokakerma kerma"],
  ["mock-010", "naudan jauheliha 10 %", null, 400, "g", 3.99, "jauheliha naudan ground beef"],
  ["mock-011", "naudan jauheliha 17 %", null, 400, "g", 4.49, "jauheliha naudan"],
  ["mock-012", "sika-nauta jauheliha 23 %", null, 400, "g", 2.99, "jauheliha sika-nauta"],
  ["mock-020", "broilerin fileesuikale maustamaton", null, 400, "g", 4.29, "broilerin suikale broileri kana"],
  ["mock-021", "kananpojan fileesuikale maustamaton", null, 450, "g", 5.49, "broilerin suikale broileri kana"],
  ["mock-022", "broilerin rintafilee", null, 600, "g", 7.49, "broilerinfilee broileri kana chicken breast"],
  ["mock-030", "lohifilee nahaton", null, 400, "g", 7.99, "lohi lohifilee salmon"],
  ["mock-031", "lohifilee C-leikattu", null, 500, "g", 9.95, "lohi lohifilee"],
  ["mock-040", "kiinteä peruna", null, 2, "kg", 1.69, "peruna potato"],
  ["mock-041", "Varhaisperuna irtomyynti", null, 1, "kg", 1.29, "peruna"],
  ["mock-042", "porkkana", null, 1, "kg", 0.99, "porkkana carrot"],
  ["mock-043", "keltasipuli", null, 1, "kg", 1.09, "sipuli keltasipuli onion"],
  ["mock-044", "Punasipuli", null, 500, "g", 0.99, "punasipuli red onion"],
  ["mock-045", "Valkosipuli 3 kpl", null, 3, "kpl", 0.99, "valkosipuli garlic"],
  ["mock-046", "Tilli ruukku", null, 1, "ruukku", 1.49, "tilli dill"],
  ["mock-047", "Punainen paprika", null, 1, "kpl", 0.89, "paprika bell pepper"],
  ["mock-048", "Bataatti", null, 1, "kg", 2.49, "bataatti sweet potato"],
  ["mock-049", "Babypinaatti", null, 65, "g", 1.49, "pinaatti spinach babypinaatti"],
  ["mock-050", "Inkivääri", null, 100, "g", 0.59, "inkivääri ginger"],
  ["mock-060", "riisi jasmiini", null, 1, "kg", 1.99, "riisi jasmiiniriisi rice"],
  ["mock-061", "vehnäjauho", null, 2, "kg", 1.25, "vehnäjauho jauho flour"],
  ["mock-062", "tomaattimurska", null, 400, "g", 0.65, "tomaattimurska crushed tomatoes"],
  ["mock-063", "kikherneet", null, 400, "g", 0.79, "kikherne chickpeas"],
  ["mock-064", "kookosmaito", null, 400, "ml", 1.29, "kookosmaito coconut milk"],
  ["mock-065", "punainen currytahna", null, 113, "g", 2.79, "currytahna curry paste"],
  ["mock-066", "kalaliemikuutio", null, 6, "kpl", 1.49, "kalaliemi liemikuutio"],
  ["mock-067", "lihaliemikuutio", null, 6, "kpl", 1.49, "lihaliemi liemikuutio"],
  ["mock-068", "kanaliemikuutio", null, 6, "kpl", 1.49, "kanaliemi liemikuutio"],
  ["mock-069", "rypsiöljy", null, 1, "l", 2.89, "rypsiöljy öljy oil"],
  ["mock-070", "maustepippuri kokonainen", null, 30, "g", 1.99, "maustepippuri allspice"],
  ["mock-071", "laakerinlehti", null, 5, "g", 1.69, "laakerinlehti bay leaf"],
  ["mock-072", "paprikajauhe", null, 40, "g", 1.79, "paprikajauhe paprika"],
  ["mock-080", "kevytmaito", null, 1, "l", 0.99, "maito milk"],
  ["mock-081", "voi normaalisuolainen", null, 500, "g", 4.49, "voi butter"],
  ["mock-082", "kananmunat M 10 kpl", null, 10, "kpl", 2.49, "kananmuna muna egg"],
];

function toProduct(r: Row): StoreProduct {
  const [id, name, brand, pack, unit, price] = r;
  const perKgOrL =
    unit === "g" ? { v: (price / pack) * 1000, u: "kg" } :
    unit === "kg" ? { v: price / pack, u: "kg" } :
    unit === "ml" ? { v: (price / pack) * 1000, u: "l" } :
    unit === "dl" ? { v: (price / pack) * 10, u: "l" } :
    unit === "l" ? { v: price / pack, u: "l" } :
    unit === "kpl" ? { v: price / pack, u: "kpl" } : null;
  return {
    storeId: "smarket",
    source: "mock",
    externalId: id,
    ean: null,
    name: name.charAt(0).toUpperCase() + name.slice(1),
    brand,
    packSize: pack,
    packUnit: unit,
    price,
    unitPrice: perKgOrL ? Math.round(perKgOrL.v * 100) / 100 : null,
    unitPriceUnit: perKgOrL?.u ?? null,
    storeExternalId: "mock-store",
  };
}

function score(r: Row, q: string): number {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hay = `${r[1]} ${r[6]}`.toLowerCase();
  let s = 0;
  for (const w of words) {
    if (r[6].toLowerCase().split(" ").includes(w)) s += 3;
    else if (hay.includes(w)) s += 1;
  }
  return s;
}

export class MockSKaupatAdapter implements StoreAdapter {
  readonly id = "s-kaupat:mock";
  readonly storeId = "smarket" as const;
  readonly status = "MOCK" as const;
  readonly description = "Mock S-kaupat catalogue with invented prices (real endpoint not verified)";

  async searchProducts(query: string): Promise<StoreProduct[]> {
    return ROWS.map((r) => ({ r, s: score(r, query) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || a.r[5] - b.r[5])
      .slice(0, 10)
      .map((x) => toProduct(x.r));
  }

  async getProduct(externalId: string): Promise<StoreProduct | null> {
    const r = ROWS.find((x) => x[0] === externalId);
    return r ? toProduct(r) : null;
  }

  async getOffers() {
    return [];
  }
}

export class NoneAdapter implements StoreAdapter {
  readonly id = "s-kaupat:none";
  readonly storeId = "smarket" as const;
  readonly status = "OFF" as const;
  readonly description = "No S-kaupat data source configured; add products manually";
  async searchProducts() {
    return [];
  }
  async getProduct() {
    return null;
  }
  async getOffers() {
    return [];
  }
}
