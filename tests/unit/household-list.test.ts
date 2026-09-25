import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addHousehold, listHousehold } from "@/lib/services/household";
import { answerRefill, generateListForPlan, getList, moveCheckedToPantry, setChecked } from "@/lib/services/lists";
import { addMeal, createPlan } from "@/lib/services/plans";
import { listRecipes } from "@/lib/services/recipes";
import { listPantry } from "@/lib/services/pantry";
import { todayHelsinki } from "@/lib/domain/offers";

// Real services against a throwaway embedded Postgres (migrated + seeded on first use).
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aitta-it-"));
process.env.PGLITE_DIR = dir;
delete process.env.DATABASE_URL;

const rows = async (listId: string, nameFi: string) => (await getList(listId))!.items.filter((i) => i.nameFi === nameFi);
const household = async (nameFi: string) => (await listHousehold()).find((h) => h.nameFi === nameFi)!;

describe("household refills on a generated list", () => {
  let planId: string;
  let listId: string;

  beforeAll(async () => {
    const refill = { intervalDays: 14, quantity: 1, unit: "pkt" };
    await addHousehold({ name: "WC-paperi", nameFi: "wc-paperi", ...refill });
    await addHousehold({ name: "WC-paperi", nameFi: "wc-paperi", ...refill, intervalDays: 28 }); // same item again
    await addHousehold({ name: "Kahvi", nameFi: "kahvi", intervalDays: 14, quantity: 500, unit: "g" });
    await addHousehold({ name: "Kerma", nameFi: "kerma", intervalDays: 7, quantity: 2, unit: "dl" }); // also in the recipe
    await addHousehold({ name: "Suola", nameFi: "suola", intervalDays: 60, quantity: 1, unit: "pkt" }); // also a staple ("have it?")
    const lohikeitto = (await listRecipes()).find((r) => r.title === "Lohikeitto")!;
    planId = (await createPlan({})).id;
    await addMeal(planId, lohikeitto.id);
    listId = await generateListForPlan(planId);
  });

  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  it("keeps one household item per ingredient, filed in its store section", async () => {
    const all = await listHousehold();
    expect(all.filter((h) => h.nameFi === "wc-paperi")).toHaveLength(1);
    expect((await household("wc-paperi")).intervalDays).toBe(28);
    expect((await household("kahvi")).section).toBe("juomat");
  });

  it("adds a refill row only for items not already on the list", async () => {
    expect(await rows(listId, "wc-paperi")).toMatchObject([{ state: "refill" }]);
    // Recipe row and staple question absorb the refill instead of duplicating it.
    const kerma = await rows(listId, "kerma");
    expect(kerma).toHaveLength(1);
    expect(kerma[0].state).toBe("none");
    const suola = await rows(listId, "suola");
    expect(suola).toHaveLength(1);
    expect(suola[0].state).toBe("ask");
  });

  it("checking a merged recipe row counts as buying the refill; unchecking undoes it", async () => {
    const [kerma] = await rows(listId, "kerma");
    await setChecked(listId, kerma.id, true);
    expect((await household("kerma")).lastBoughtOn).toBe(todayHelsinki());
    await setChecked(listId, kerma.id, false);
    expect((await household("kerma")).lastBoughtOn).toBeNull();
  });

  it("keeps answers across regeneration, and only food goes to the pantry", async () => {
    const [wc] = await rows(listId, "wc-paperi");
    await answerRefill(listId, wc.id, true);
    await generateListForPlan(planId);
    const again = await rows(listId, "wc-paperi");
    expect(again).toHaveLength(1);
    expect(again[0].state).toBe("none");

    const [kerma] = await rows(listId, "kerma");
    await setChecked(listId, again[0].id, true);
    await setChecked(listId, kerma.id, true);
    await moveCheckedToPantry(listId);
    const pantry = (await listPantry()).map((p) => p.nameFi);
    expect(pantry).toContain("kerma");
    expect(pantry).not.toContain("wc-paperi");
  });
});
