"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth-server";
import type { RecipeDraft } from "@/lib/domain/recipe-draft";
import { deleteRecipe, saveRecipe } from "@/lib/services/recipes";
import {
  discardDraft,
  importFromFile,
  importFromImages,
  importFromUrl,
  importManual,
  ingredientsFromLines,
  saveDraft,
  suggestNormalization,
} from "@/lib/services/imports";
import { describeAiError } from "@/lib/ai/client";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

function fail(e: unknown): { ok: false; error: string } {
  const msg = describeAiError(e);
  console.error("[action]", msg);
  return { ok: false, error: msg };
}

export async function importUrlAction(url: string): Promise<ActionResult<string>> {
  await requireAuth();
  try {
    return { ok: true, data: await importFromUrl(url) };
  } catch (e) {
    return fail(e);
  }
}

export async function importPhotosAction(originalIds: string[]): Promise<ActionResult<string>> {
  await requireAuth();
  try {
    return { ok: true, data: await importFromImages(originalIds) };
  } catch (e) {
    return fail(e);
  }
}

export async function importFileAction(originalId: string): Promise<ActionResult<string>> {
  await requireAuth();
  try {
    return { ok: true, data: await importFromFile(originalId) };
  } catch (e) {
    return fail(e);
  }
}

export async function startManualAction() {
  await requireAuth();
  const batchId = await importManual();
  redirect(`/recipes/import/${batchId}`);
}

export async function saveDraftAction(draftId: string, draft: RecipeDraft): Promise<ActionResult<string>> {
  await requireAuth();
  try {
    const id = await saveDraft(draftId, draft);
    revalidatePath("/recipes");
    return { ok: true, data: id };
  } catch (e) {
    return fail(e);
  }
}

export async function discardDraftAction(draftId: string): Promise<ActionResult> {
  await requireAuth();
  await discardDraft(draftId);
  return { ok: true };
}

export async function saveRecipeAction(recipeId: string, draft: RecipeDraft): Promise<ActionResult<string>> {
  await requireAuth();
  try {
    const id = await saveRecipe(draft, recipeId);
    revalidatePath(`/recipes/${id}`);
    return { ok: true, data: id };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteRecipeAction(formData: FormData) {
  await requireAuth();
  await deleteRecipe(String(formData.get("id")));
  revalidatePath("/recipes");
  redirect("/recipes");
}

export async function normalizeNameAction(name: string) {
  await requireAuth();
  return suggestNormalization(name);
}

export async function parseLinesAction(lines: string[]) {
  await requireAuth();
  return ingredientsFromLines(lines.filter((l) => l.trim()));
}
