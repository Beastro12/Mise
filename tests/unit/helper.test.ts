import { describe, expect, it } from "vitest";
import { chooseSlot, isForbidden, parseSlot, planCart } from "../../helper/lib/plan.mjs";

const order = {
  delivery: { substitutions: "alternate", weekday: 6, windowStart: "10:00", windowEnd: "14:00" },
  items: [
    { ingredient: "kerma", quantity: 2, primary: { ean: "6400000000001", name: "Kerma", source: "manual" }, alternate: { ean: "6400000000002", name: "Kerma 2", source: "manual" } },
    { ingredient: "peruna", quantity: 1, primary: { ean: null, s_kaupat_product_id: null, name: "Peruna", source: "mock" }, alternate: null },
    { ingredient: "wc-paperi", quantity: 1.4, primary: { ean: null, s_kaupat_product_id: "123", name: "WC-paperi", source: "s-kaupat" }, alternate: null },
  ],
  unmapped: [{ ingredient: "tilli", needed: "0,25 nippu" }],
};

describe("S-kaupat helper: cart plan", () => {
  it("builds steps with fallback and reports what it can't add", () => {
    const { steps, missing } = planCart(order);
    expect(steps.map((s: { ingredient: string }) => s.ingredient)).toEqual(["kerma", "wc-paperi"]);
    expect(steps[0].choices.map((c: { query: string }) => c.query)).toEqual(["6400000000001", "6400000000002"]);
    expect(steps[1]).toMatchObject({ quantity: 1, choices: [{ query: "123" }] });
    expect(missing.map((m: { ingredient: string }) => m.ingredient)).toEqual(["tilli", "peruna"]);
  });

  it("drops the 2nd choice when substitutions are off", () => {
    const { steps } = planCart({ ...order, delivery: { ...order.delivery, substitutions: "none" } });
    expect(steps[0].choices).toHaveLength(1);
  });
});

describe("S-kaupat helper: delivery slot", () => {
  it("parses Finnish slot labels", () => {
    expect(parseSlot("La 27.9. 10.00–12.00")).toEqual({ weekday: 6, start: 600, end: 720 });
    expect(parseSlot("perjantai klo 16-18")).toEqual({ weekday: 5, start: 960, end: 1080 });
  });

  it("prefers the weekday + window, then same day, then earliest", () => {
    const pref = { weekday: 6, windowStart: "10:00", windowEnd: "14:00" };
    expect(chooseSlot(["Pe 26.9. 16.00–18.00", "La 27.9. 8.00–10.00", "La 27.9. 12.00–14.00"], pref)).toMatchObject({ index: 2, match: "preferred" });
    expect(chooseSlot(["Pe 26.9. 16.00–18.00", "La 27.9. 18.00–20.00"], pref)).toMatchObject({ index: 1, match: "same day, other time" });
    expect(chooseSlot(["Ma 29.9. 10.00–12.00"], pref)).toMatchObject({ index: 0, match: "earliest available" });
    expect(chooseSlot([], pref)).toBeNull();
  });
});

describe("S-kaupat helper: never places the order", () => {
  it("refuses order/payment buttons", () => {
    for (const t of ["Vahvista tilaus", "Tilaa", "Tilaa nyt", "Siirry maksamaan", "Maksa", "Place order"]) expect(isForbidden(t)).toBe(true);
    for (const t of ["Lisää ostoskoriin", "Siirry kassalle", "Kotiinkuljetus", "Valitse aika"]) expect(isForbidden(t)).toBe(false);
  });
});
