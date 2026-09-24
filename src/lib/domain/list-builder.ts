import type { StoreId } from "@/db/schema";
import { aggregateMeals, type LineSource, type MealInput } from "./aggregate";
import { markStaples, subtractPantry, type LineState, type PantryEntry } from "./pantry";
import { findOffer, type OfferInfo } from "./offers";
import { decideStore } from "./store-split";
import { packsNeeded } from "./packs";
import { resolveSectionOrder, toSectionKey, type SectionKey } from "./sections";

export type ProductInfo = {
  id: string;
  price: number | null;
  unitPrice: number | null;
  unitPriceUnit: string | null;
  packSize: number | null;
  packUnit: string | null;
};

export type BuildListInput = {
  meals: MealInput[];
  pantry: PantryEntry[];
  staples: Set<string>;
  offers: OfferInfo[];
  rules: Map<string, StoreId>;
  /** nameFi → per-store mapped product */
  mappings: Map<string, Partial<Record<StoreId, ProductInfo>>>;
  /** nameFi → store chosen manually on a previous version of this list */
  overrides?: Map<string, StoreId>;
  today: string;
};

export type BuiltItem = {
  nameFi: string;
  displayName: string;
  quantity: number | null;
  unit: string | null;
  section: SectionKey;
  storeId: StoreId;
  storeReason: string | null;
  storeOverridden: boolean;
  productId: string | null;
  packs: number | null;
  price: number | null;
  offerId: string | null;
  sources: LineSource[];
  state: LineState;
  note: string | null;
};

export function buildShoppingList(input: BuildListInput): BuiltItem[] {
  const aggregated = aggregateMeals(input.meals);
  const withPantry = markStaples(subtractPantry(aggregated, input.pantry), input.staples);

  return withPantry.map((line) => {
    const mapped = input.mappings.get(line.nameFi) ?? {};
    const override = input.overrides?.get(line.nameFi) ?? null;
    const offer = findOffer(line.nameFi, input.offers, input.today);
    const s = mapped.smarket ?? null;
    const decision = decideStore({
      nameFi: line.nameFi,
      override,
      rule: input.rules.get(line.nameFi) ?? null,
      offer,
      smarket: s ? { price: s.price, unitPrice: s.unitPrice, unitPriceUnit: s.unitPriceUnit } : null,
      today: input.today,
    });
    const product = mapped[decision.storeId] ?? null;
    const packs = product ? packsNeeded(line.quantity, line.unit, product.packSize, product.packUnit) : null;
    const price = decision.offerId && offer ? offer.price : (product?.price ?? null);

    return {
      nameFi: line.nameFi,
      displayName: line.displayName,
      quantity: line.quantity,
      unit: line.unit,
      section: line.section,
      storeId: decision.storeId,
      storeReason: decision.reason,
      storeOverridden: !!override,
      productId: product?.id ?? null,
      packs,
      price,
      offerId: decision.offerId,
      sources: line.sources,
      state: line.state,
      note: line.notes.length ? line.notes.join("; ") : null,
    };
  });
}

export type DisplayGroup<T> = {
  storeId: StoreId;
  sections: Array<{ key: SectionKey; items: T[] }>;
};

/** Group by store (S-market first), then by that store's section walking order. */
export function groupForDisplay<T extends { storeId: StoreId; section: string; displayName: string }>(
  items: T[],
  sectionOrder: Partial<Record<StoreId, string[]>>,
): DisplayGroup<T>[] {
  const stores: StoreId[] = ["smarket", "lidl"];
  const out: DisplayGroup<T>[] = [];
  for (const storeId of stores) {
    const inStore = items.filter((i) => i.storeId === storeId);
    if (!inStore.length) continue;
    const order = resolveSectionOrder(sectionOrder[storeId]);
    const sections = order
      .map((key) => ({
        key,
        items: inStore
          .filter((i) => toSectionKey(i.section) === key)
          .sort((a, b) => a.displayName.localeCompare(b.displayName, "fi")),
      }))
      .filter((s) => s.items.length);
    out.push({ storeId, sections });
  }
  return out;
}
