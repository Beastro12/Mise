import { NextResponse } from "next/server";
import { z } from "zod";
import { publicRoute } from "@/lib/api";
import { isHelperRequest } from "@/lib/helper-auth";
import { createManualProduct, setAlternate, setMapping } from "@/lib/services/products";
import { applyMappingToLists } from "@/lib/services/lists";
import { CANONICAL_UNITS } from "@/lib/domain/units";

export const dynamic = "force-dynamic";

const body = z.object({
  nameFi: z.string().min(1),
  rank: z.union([z.literal(1), z.literal(2)]),
  product: z.object({
    externalId: z.string().min(1).nullable(),
    ean: z.string().regex(/^\d{8,14}$/).nullable(),
    name: z.string().min(1),
    brand: z.string().nullable().optional(),
    packSize: z.number().positive().nullable().optional(),
    packUnit: z.string().nullable().optional(),
    price: z.number().nonnegative().nullable().optional(),
    unitPrice: z.number().nonnegative().nullable().optional(),
    unitPriceUnit: z.string().nullable().optional(),
  }),
});

/** Save a product picked on the real S-kaupat site as the 1st or 2nd choice for an ingredient. */
export async function POST(req: Request) {
  return publicRoute(async () => {
    if (!(await isHelperRequest(req))) return NextResponse.json({ error: "Invalid helper key" }, { status: 401 });
    const parsed = body.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, { status: 400 });
    const { nameFi, rank, product: p } = parsed.data;
    const unit = p.packUnit && CANONICAL_UNITS.includes(p.packUnit) ? p.packUnit : null;
    const row = await createManualProduct({
      source: "s-kaupat",
      externalId: p.externalId ?? p.ean,
      ean: p.ean,
      name: p.name,
      brand: p.brand ?? null,
      packSize: unit ? (p.packSize ?? null) : null,
      packUnit: unit,
      price: p.price ?? null,
      unitPrice: p.unitPrice ?? null,
      unitPriceUnit: p.unitPriceUnit ?? null,
    });
    const key = nameFi.trim().toLowerCase();
    if (rank === 1) {
      await setMapping(key, "smarket", row.id);
      await applyMappingToLists(key, row.id);
    } else {
      await setAlternate(key, "smarket", row.id);
    }
    return NextResponse.json({ ok: true, productId: row.id });
  });
}
