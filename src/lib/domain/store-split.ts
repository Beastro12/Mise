import type { StoreId } from "@/db/schema";
import { formatPrice, formatUntil, type OfferInfo } from "./offers";

export type KnownPrice = { price: number | null; unitPrice: number | null; unitPriceUnit: string | null };

export type SplitInput = {
  nameFi: string;
  /** Manual choice on this list item. Always wins. */
  override?: StoreId | null;
  /** Remembered "always buy X at …" rule. */
  rule?: StoreId | null;
  /** Active Lidl offer matching this ingredient, if any. */
  offer?: OfferInfo | null;
  /** Known S-market price for the mapped product, if any. */
  smarket?: KnownPrice | null;
  today: string;
};

export type SplitDecision = { storeId: StoreId; reason: string | null; offerId: string | null };

type Comparison = { lidl: number; smarket: number; basis: "unit" | "pack" };

/**
 * Compare Lidl offer vs S-market price. Unit prices (€/kg, €/l) are compared
 * when both sides have one in the same unit; otherwise pack prices.
 * Returns null when either price is unknown.
 */
export function comparePrices(offer: OfferInfo, s: KnownPrice | null | undefined): Comparison | null {
  if (!s) return null;
  if (
    offer.unitPrice != null &&
    s.unitPrice != null &&
    offer.unitPriceUnit &&
    s.unitPriceUnit &&
    offer.unitPriceUnit.toLowerCase() === s.unitPriceUnit.toLowerCase()
  ) {
    return { lidl: offer.unitPrice, smarket: s.unitPrice, basis: "unit" };
  }
  if (s.price != null) return { lidl: offer.price, smarket: s.price, basis: "pack" };
  return null;
}

/**
 * Store split rule:
 *   1. manual override on the item
 *   2. remembered rule for the ingredient
 *   3. active Lidl offer → Lidl, unless S-market is known to be cheaper or equal
 *   4. otherwise S-market
 */
export function decideStore(input: SplitInput): SplitDecision {
  if (input.override) {
    return { storeId: input.override, reason: "Set manually", offerId: null };
  }
  if (input.rule) {
    return {
      storeId: input.rule,
      reason: `Your rule: always at ${input.rule === "lidl" ? "Lidl" : "S-market"}`,
      offerId: null,
    };
  }
  const offer = input.offer;
  if (offer) {
    const until = formatUntil(offer.validTo, input.today);
    const cmp = comparePrices(offer, input.smarket);
    if (!cmp) {
      return { storeId: "lidl", reason: `Lidl offer ${until}, ${formatPrice(offer.price)}`, offerId: offer.id };
    }
    const suffix = cmp.basis === "unit" ? `/${offer.unitPriceUnit}` : "";
    if (cmp.lidl < cmp.smarket) {
      return {
        storeId: "lidl",
        reason: `Lidl offer ${until}, ${formatPrice(cmp.lidl)}${suffix} (S-market ${formatPrice(cmp.smarket)}${suffix})`,
        offerId: offer.id,
      };
    }
    return {
      storeId: "smarket",
      reason: `Lidl offer ${formatPrice(cmp.lidl)}${suffix} is not cheaper than S-market ${formatPrice(cmp.smarket)}${suffix}`,
      offerId: null,
    };
  }
  return { storeId: "smarket", reason: null, offerId: null };
}
