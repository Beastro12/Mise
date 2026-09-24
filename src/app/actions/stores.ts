"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth-server";
import type { StoreId } from "@/db/schema";
import { moveSection, removeRule, removeStaple, addStaple, setRule, updateSMarket } from "@/lib/services/settings";
import { addManualOffer, deleteExpiredOffers, deleteOffer, importOffersFromImages, importOffersFromText, updateOfferName } from "@/lib/services/offers";
import { deleteSynonym, upsertSynonym } from "@/lib/services/vocab";
import { clearMapping, createManualProduct, setMapping } from "@/lib/services/products";
import { describeAiError } from "@/lib/ai/client";
import { applyMappingToLists } from "@/lib/services/lists";
import { redirect } from "next/navigation";

function safeReturn(v: string): string | null {
  return v.startsWith("/") && !v.startsWith("//") ? v : null;
}

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (f: FormData, k: string) => {
  const s = str(f, k).replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};
const store = (s: string): StoreId => (s === "lidl" ? "lidl" : "smarket");

export async function updateSMarketAction(formData: FormData) {
  await requireAuth();
  await updateSMarket(str(formData, "name"), str(formData, "externalId") || null);
  revalidatePath("/stores");
}

export async function moveSectionAction(formData: FormData) {
  await requireAuth();
  await moveSection(store(str(formData, "storeId")), str(formData, "section"), str(formData, "dir") === "up" ? -1 : 1);
  revalidatePath("/stores");
}

export async function importOffersTextAction(
  text: string,
  from: string,
  to: string,
): Promise<{ ok: boolean; message: string }> {
  await requireAuth();
  try {
    const r = await importOffersFromText(text, from, to);
    revalidatePath("/stores/lidl");
    return { ok: true, message: `Added ${r.count} offers.${r.warnings.length ? ` ${r.warnings.join(" ")}` : ""}` };
  } catch (e) {
    return { ok: false, message: describeAiError(e) };
  }
}

export async function importOffersPhotosAction(
  originalIds: string[],
  from: string,
  to: string,
): Promise<{ ok: boolean; message: string }> {
  await requireAuth();
  try {
    const r = await importOffersFromImages(originalIds, from, to);
    revalidatePath("/stores/lidl");
    return { ok: true, message: `Added ${r.count} offers.${r.warnings.length ? ` ${r.warnings.join(" ")}` : ""}` };
  } catch (e) {
    return { ok: false, message: describeAiError(e) };
  }
}

export async function addOfferAction(formData: FormData) {
  await requireAuth();
  const price = num(formData, "price");
  if (!str(formData, "productName") || price == null) return;
  await addManualOffer({
    productName: str(formData, "productName"),
    nameFi: str(formData, "nameFi") || undefined,
    price,
    unitText: str(formData, "unitText") || null,
    unitPrice: num(formData, "unitPrice"),
    unitPriceUnit: str(formData, "unitPriceUnit") || null,
    validFrom: str(formData, "validFrom"),
    validTo: str(formData, "validTo"),
  });
  revalidatePath("/stores/lidl");
}

export async function renameOfferAction(formData: FormData) {
  await requireAuth();
  await updateOfferName(str(formData, "id"), str(formData, "nameFi"));
  revalidatePath("/stores/lidl");
}

export async function deleteOfferAction(formData: FormData) {
  await requireAuth();
  await deleteOffer(str(formData, "id"));
  revalidatePath("/stores/lidl");
}

export async function clearExpiredOffersAction() {
  await requireAuth();
  await deleteExpiredOffers();
  revalidatePath("/stores/lidl");
}

export async function addStapleAction(formData: FormData) {
  await requireAuth();
  await addStaple(str(formData, "nameFi"));
  revalidatePath("/settings");
}

export async function removeStapleAction(formData: FormData) {
  await requireAuth();
  await removeStaple(str(formData, "nameFi"));
  revalidatePath("/settings");
}

export async function setRuleAction(formData: FormData) {
  await requireAuth();
  await setRule(str(formData, "nameFi"), store(str(formData, "storeId")));
  revalidatePath("/settings");
}

export async function removeRuleAction(formData: FormData) {
  await requireAuth();
  await removeRule(str(formData, "nameFi"));
  revalidatePath("/settings");
}

export async function upsertSynonymAction(formData: FormData) {
  await requireAuth();
  await upsertSynonym(str(formData, "term"), str(formData, "nameFi"), str(formData, "category") || null);
  revalidatePath("/settings/synonyms");
}

export async function deleteSynonymAction(formData: FormData) {
  await requireAuth();
  await deleteSynonym(str(formData, "id"));
  revalidatePath("/settings/synonyms");
}

export async function mapProductAction(formData: FormData) {
  await requireAuth();
  const nameFi = str(formData, "nameFi");
  await setMapping(nameFi, store(str(formData, "storeId")), str(formData, "productId"));
  await applyMappingToLists(nameFi, str(formData, "productId"));
  revalidatePath("/products");
  const back = safeReturn(str(formData, "return"));
  if (back) redirect(back);
}

export async function clearMappingAction(formData: FormData) {
  await requireAuth();
  const nameFi = str(formData, "nameFi");
  await clearMapping(nameFi, store(str(formData, "storeId")));
  await applyMappingToLists(nameFi, null);
  revalidatePath("/products");
}

export async function manualProductAction(formData: FormData) {
  await requireAuth();
  const name = str(formData, "name");
  if (!name) return;
  const p = await createManualProduct({
    externalId: str(formData, "externalId") || null,
    ean: str(formData, "ean") || null,
    name,
    brand: str(formData, "brand") || null,
    packSize: num(formData, "packSize"),
    packUnit: str(formData, "packUnit") || null,
    price: num(formData, "price"),
    unitPrice: num(formData, "unitPrice"),
    unitPriceUnit: str(formData, "unitPriceUnit") || null,
  });
  const nameFi = str(formData, "nameFi");
  if (nameFi) {
    await setMapping(nameFi, "smarket", p.id);
    await applyMappingToLists(nameFi, p.id);
  }
  revalidatePath("/products");
  const back = safeReturn(str(formData, "return"));
  if (back) redirect(back);
}
