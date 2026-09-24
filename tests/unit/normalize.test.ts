import { describe, expect, it } from "vitest";
import { buildSynonymIndex, departitiveWord, normalizeName } from "@/lib/domain/normalize";
import { seedSynonymPairs } from "@/lib/domain/vocabulary";

const index = buildSynonymIndex(seedSynonymPairs());

describe("ingredient name normalization", () => {
  it("maps English names to Finnish via the synonym table", () => {
    expect(normalizeName("sour cream", index)).toMatchObject({ nameFi: "kermaviili", category: "maito_juusto", matched: true });
    expect(normalizeName("Ground beef", index)).toMatchObject({ nameFi: "jauheliha", matched: true });
    expect(normalizeName("cream", index).nameFi).toBe("kerma");
  });

  it("maps Finnish partitive forms", () => {
    expect(normalizeName("kermaa", index).nameFi).toBe("kerma");
    expect(normalizeName("nahatonta lohifileetä", index).nameFi).toBe("lohi");
    expect(normalizeName("valkosipulia", index).nameFi).toBe("valkosipuli");
    expect(normalizeName("kermaviiliä", index).nameFi).toBe("kermaviili");
  });

  it("drops descriptors to find a known base ingredient", () => {
    expect(normalizeName("tuore tilli", index).nameFi).toBe("tilli");
    expect(normalizeName("jauhettu kaneli", index).nameFi).toBe("kaneli");
  });

  it("falls back to a partitive heuristic for unknown words", () => {
    const r = normalizeName("kvinoaa", index);
    expect(r).toMatchObject({ nameFi: "kvinoa", matched: false });
    expect(departitiveWord("perunoita")).toBe("peruna");
    expect(departitiveWord("tomaatteja")).toBe("tomaatti");
    expect(departitiveWord("voita")).toBe("voi");
    expect(departitiveWord("feta")).toBe("feta");
    expect(departitiveWord("punaista")).toBe("punainen");
  });
});
