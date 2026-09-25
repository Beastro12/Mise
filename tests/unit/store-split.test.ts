import { describe, expect, it } from "vitest";
import { decideStore } from "@/lib/domain/store-split";
import { findOffer, formatUntil, type OfferInfo } from "@/lib/domain/offers";

const offer = (over: Partial<OfferInfo> = {}): OfferInfo => ({
  id: "o1",
  productName: "Kermaviili 10 % 200 g",
  nameFi: "kermaviili",
  price: 1.49,
  unitPrice: null,
  unitPriceUnit: null,
  unitText: "200 g",
  validFrom: "2026-09-21",
  validTo: "2026-09-27",
  ...over,
});

const today = "2026-09-24"; // Thursday

describe("store split rule", () => {
  it("defaults to S-market", () => {
    expect(decideStore({ nameFi: "kerma", today })).toEqual({ storeId: "smarket", reason: null, offerId: null });
  });

  it("moves to Lidl on a matching offer when S-market price is unknown", () => {
    const d = decideStore({ nameFi: "kermaviili", offer: offer(), today });
    expect(d).toEqual({ storeId: "lidl", reason: "Lidl offer until Sun, 1,49 €", offerId: "o1" });
  });

  it("moves to Lidl only if cheaper when both prices are known", () => {
    const cheaper = decideStore({
      nameFi: "kermaviili",
      offer: offer(),
      smarket: { price: 1.89, unitPrice: null, unitPriceUnit: null },
      today,
    });
    expect(cheaper.storeId).toBe("lidl");
    expect(cheaper.reason).toBe("Lidl offer until Sun, 1,49 € (S-market 1,89 €)");

    const notCheaper = decideStore({
      nameFi: "kermaviili",
      offer: offer(),
      smarket: { price: 1.29, unitPrice: null, unitPriceUnit: null },
      today,
    });
    expect(notCheaper.storeId).toBe("smarket");
    expect(notCheaper.reason).toContain("not cheaper");

    const equal = decideStore({ nameFi: "kermaviili", offer: offer(), smarket: { price: 1.49, unitPrice: null, unitPriceUnit: null }, today });
    expect(equal.storeId).toBe("smarket");
  });

  it("compares unit prices when both sides have them in the same unit", () => {
    // Lidl pack is bigger: 1,49 € but 7,45 €/kg vs S-market 1,29 € at 8,60 €/kg
    const d = decideStore({
      nameFi: "kermaviili",
      offer: offer({ unitPrice: 7.45, unitPriceUnit: "kg" }),
      smarket: { price: 1.29, unitPrice: 8.6, unitPriceUnit: "kg" },
      today,
    });
    expect(d.storeId).toBe("lidl");
    expect(d.reason).toContain("7,45 €/kg");
  });

  it("manual override beats everything, rules beat offers", () => {
    expect(decideStore({ nameFi: "kermaviili", override: "smarket", rule: "lidl", offer: offer(), today }).storeId).toBe("smarket");
    const ruled = decideStore({ nameFi: "kermaviili", rule: "smarket", offer: offer(), today });
    expect(ruled).toMatchObject({ storeId: "smarket", reason: "Your rule: always at S-market" });
    expect(decideStore({ nameFi: "kerma", rule: "lidl", today }).storeId).toBe("lidl");
  });
});

describe("offer matching", () => {
  it("matches by normalized name or whole word in the product name", () => {
    expect(findOffer("kermaviili", [offer({ nameFi: "x" })], today)?.id).toBe("o1");
    expect(findOffer("kerma", [offer()], today)).toBeNull(); // "kerma" is not a whole word in "Kermaviili"
    expect(findOffer("kermaviili", [offer({ productName: "Arla smetana", nameFi: "kermaviili" })], today)?.id).toBe("o1");
  });

  it("ignores expired or future offers", () => {
    expect(findOffer("kermaviili", [offer({ validTo: "2026-09-23" })], today)).toBeNull();
    expect(findOffer("kermaviili", [offer({ validFrom: "2026-09-25" })], today)).toBeNull();
  });

  it("picks the cheapest matching offer", () => {
    const o = findOffer("kermaviili", [offer({ id: "a", price: 1.2 }), offer({ id: "b", price: 0.99 })], today);
    expect(o?.id).toBe("b");
  });

  it("formats validity", () => {
    expect(formatUntil("2026-09-27", today)).toBe("until Sun");
    expect(formatUntil("2026-10-03", today)).toBe("until 3.10.");
  });
});
