import "server-only";
import { and, asc, eq, gte, lt } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { aiAvailable } from "../ai/client";
import { extractOffers, type ImageInput } from "../ai/extract";
import { parseOfferLines } from "../import/offers-text";
import type { OfferInfo } from "../domain/offers";
import { addDays, mondayOf, todayHelsinki } from "../domain/offers";
import { getVocab, normalizeMany } from "./vocab";
import { readOriginal } from "./originals";

export type OfferRow = typeof schema.offers.$inferSelect;

export function toOfferInfo(o: OfferRow): OfferInfo {
  return {
    id: o.id,
    productName: o.productName,
    nameFi: o.nameFi,
    price: o.price,
    unitPrice: o.unitPrice,
    unitPriceUnit: o.unitPriceUnit,
    unitText: o.unitText,
    validFrom: o.validFrom,
    validTo: o.validTo,
  };
}

/** Offers still valid today or later. */
export async function listCurrentOffers(today = todayHelsinki()): Promise<OfferRow[]> {
  const db = await getDb();
  return db
    .select()
    .from(schema.offers)
    .where(and(eq(schema.offers.storeId, "lidl"), gte(schema.offers.validTo, today)))
    .orderBy(asc(schema.offers.validFrom), asc(schema.offers.productName));
}

/** Default validity for a new leaflet: this week's Monday → Sunday. */
export function defaultValidity(today = todayHelsinki()) {
  const from = mondayOf(today);
  return { from, to: addDays(from, 6) };
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const unitPriceUnit = (u: string | null | undefined) => (u && ["kg", "l", "kpl"].includes(u.toLowerCase()) ? u.toLowerCase() : null);
const validDate = (d: string | null | undefined) => (d && ISO.test(d) ? d : null);

type NewOffer = Omit<typeof schema.offers.$inferInsert, "id" | "createdAt">;

async function insertOffers(rows: NewOffer[]) {
  if (!rows.length) return 0;
  const db = await getDb();
  await db.insert(schema.offers).values(rows);
  return rows.length;
}

export async function importOffersFromText(text: string, from: string, to: string): Promise<{ count: number; warnings: string[]; usedClaude: boolean }> {
  if (aiAvailable()) {
    const { names } = await getVocab();
    const res = await extractOffers({ kind: "text", text }, todayHelsinki(), names);
    const count = await insertOffers(
      res.offers.map((o) => ({
        storeId: "lidl" as const,
        productName: o.product_name,
        nameFi: o.name_fi.trim().toLowerCase(),
        price: o.price,
        regularPrice: o.regular_price,
        unitText: o.unit_text,
        unitPrice: o.unit_price,
        unitPriceUnit: unitPriceUnit(o.unit_price_unit),
        validFrom: validDate(o.valid_from) ?? validDate(res.leaflet_valid_from) ?? from,
        validTo: validDate(o.valid_to) ?? validDate(res.leaflet_valid_to) ?? to,
        source: "leaflet_text" as const,
      })),
    );
    return { count, warnings: res.warnings, usedClaude: true };
  }
  const parsed = parseOfferLines(text);
  const norm = await normalizeMany(parsed.map((p) => stripSize(p.productName)));
  const count = await insertOffers(
    parsed.map((p) => ({
      storeId: "lidl" as const,
      productName: p.productName,
      nameFi: norm.get(stripSize(p.productName))!.nameFi,
      price: p.price,
      regularPrice: null,
      unitText: p.unitText,
      unitPrice: p.unitPrice,
      unitPriceUnit: p.unitPriceUnit,
      validFrom: from,
      validTo: to,
      source: "leaflet_text" as const,
    })),
  );
  return {
    count,
    warnings: ["Parsed locally (no Claude): check the Finnish names below, they drive matching."],
    usedClaude: false,
  };
}

/** "Kermaviili 10 % 200 g" → "Kermaviili" for local normalization. */
function stripSize(name: string): string {
  return name
    .replace(/\d+(?:[.,]\d+)?\s*(?:x\s*\d+(?:[.,]\d+)?\s*)?(?:kg|g|ml|dl|cl|l|kpl|%)\b/gi, "")
    .replace(/\s+%/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function importOffersFromImages(originalIds: string[], from: string, to: string) {
  const images: ImageInput[] = [];
  for (const id of originalIds) {
    const o = await readOriginal(id);
    if (!o?.data) throw new Error("An uploaded leaflet page could not be read back.");
    images.push({ data: o.data.toString("base64"), mediaType: (o.row.mime ?? "image/jpeg") as ImageInput["mediaType"] });
  }
  const { names } = await getVocab();
  const res = await extractOffers({ kind: "images", images }, todayHelsinki(), names);
  const count = await insertOffers(
    res.offers.map((o) => ({
      storeId: "lidl" as const,
      productName: o.product_name,
      nameFi: o.name_fi.trim().toLowerCase(),
      price: o.price,
      regularPrice: o.regular_price,
      unitText: o.unit_text,
      unitPrice: o.unit_price,
      unitPriceUnit: unitPriceUnit(o.unit_price_unit),
      validFrom: validDate(o.valid_from) ?? validDate(res.leaflet_valid_from) ?? from,
      validTo: validDate(o.valid_to) ?? validDate(res.leaflet_valid_to) ?? to,
      source: "leaflet_photo" as const,
      originalId: originalIds[0],
    })),
  );
  return { count, warnings: res.warnings };
}

export async function addManualOffer(input: {
  productName: string;
  nameFi?: string;
  price: number;
  unitText?: string | null;
  unitPrice?: number | null;
  unitPriceUnit?: string | null;
  validFrom: string;
  validTo: string;
}) {
  const nameFi = input.nameFi?.trim().toLowerCase() || (await normalizeMany([stripSize(input.productName)])).get(stripSize(input.productName))!.nameFi;
  await insertOffers([
    {
      storeId: "lidl",
      productName: input.productName.trim(),
      nameFi,
      price: input.price,
      regularPrice: null,
      unitText: input.unitText ?? null,
      unitPrice: input.unitPrice ?? null,
      unitPriceUnit: input.unitPriceUnit ?? null,
      validFrom: input.validFrom,
      validTo: input.validTo,
      source: "manual",
    },
  ]);
}

export async function updateOfferName(id: string, nameFi: string) {
  const db = await getDb();
  await db.update(schema.offers).set({ nameFi: nameFi.trim().toLowerCase() }).where(eq(schema.offers.id, id));
}

export async function deleteOffer(id: string) {
  const db = await getDb();
  await db.delete(schema.offers).where(eq(schema.offers.id, id));
}

export async function deleteExpiredOffers(today = todayHelsinki()) {
  const db = await getDb();
  await db.delete(schema.offers).where(lt(schema.offers.validTo, today));
}
