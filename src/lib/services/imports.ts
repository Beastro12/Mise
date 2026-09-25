import "server-only";
import { asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { aiAvailable, AiUnavailableError, describeAiError } from "../ai/client";
import { extractRecipes, type ImageInput, type RecipeSource } from "../ai/extract";
import { draftFromExtraction } from "../import/claude-map";
import { fetchImage, fetchPage } from "../import/fetch-page";
import { extractJsonLdRecipes, pageText, type LdRecipe } from "../import/jsonld";
import { splitRecipesFromText, type TextRecipe } from "../import/text-heuristic";
import { detectFileKind, docxToText, pdfToText } from "../import/files";
import { cleanTags, emptyDraft, recipeDraftSchema, type IngredientDraft, type RecipeDraft } from "../domain/recipe-draft";
import { parseIngredientLines } from "../domain/ingredient-parser";
import { getVocab, normalizeMany, rememberSynonyms } from "./vocab";
import { getOriginals, readOriginal, saveUpload, saveUrlOriginal } from "./originals";
import { saveRecipe } from "./recipes";

type BatchKind = "photo" | "url" | "file" | "manual";

async function createBatch(kind: BatchKind, originalIds: string[], drafts: RecipeDraft[], message?: string) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [batch] = await tx.insert(schema.importBatches).values({ kind, originalIds, message }).returning();
    if (drafts.length) {
      await tx.insert(schema.importDrafts).values(drafts.map((draft, position) => ({ batchId: batch.id, position, draft })));
    }
    return batch.id;
  });
}

/** Parse ingredient lines locally, normalizing names (synonyms → Claude if configured). */
export async function ingredientsFromLines(lines: string[]): Promise<IngredientDraft[]> {
  const parsed = parseIngredientLines(lines);
  const norm = await normalizeMany(parsed.map((p) => p.name));
  return parsed.map((p) => {
    const n = norm.get(p.name)!;
    return {
      quantity: p.quantity,
      unit: p.unit,
      originalText: p.originalText,
      name: p.name,
      nameFi: n.nameFi,
      prepNote: p.prepNote,
      category: n.category,
      optional: p.optional,
    };
  });
}

async function draftFromLd(ld: LdRecipe, url: string, originalIds: string[]): Promise<RecipeDraft> {
  return {
    ...emptyDraft("url"),
    title: ld.title,
    sourceUrl: url,
    sourceNote: new URL(url).hostname,
    servings: ld.servings && ld.servings > 0 ? ld.servings : 2,
    prepMinutes: ld.prepMinutes,
    cookMinutes: ld.cookMinutes,
    tags: cleanTags(ld.tags),
    ingredients: await ingredientsFromLines(ld.ingredients),
    steps: ld.steps,
    notes: ld.description,
    originalIds,
    warnings: [
      "Imported from the page's schema.org Recipe data.",
      ...(ld.servings ? [] : ["Servings were not in the page; defaulted to 2."]),
    ],
  };
}

async function draftFromText(tr: TextRecipe, sourceType: RecipeDraft["sourceType"], sourceNote: string, originalIds: string[]): Promise<RecipeDraft> {
  return {
    ...emptyDraft(sourceType),
    title: tr.title,
    sourceNote,
    servings: tr.servings ?? 2,
    prepMinutes: tr.prepMinutes,
    cookMinutes: tr.cookMinutes,
    ingredients: await ingredientsFromLines(tr.ingredientLines),
    steps: tr.steps,
    notes: tr.notes,
    originalIds,
    warnings: ["Parsed locally without Claude (no API key); check the split and the fields."],
  };
}

async function draftsViaClaude(
  src: RecipeSource,
  meta: { sourceType: RecipeDraft["sourceType"]; sourceUrl?: string; sourceNote?: string; originalIds: string[]; imageOriginalIds?: string[] },
): Promise<RecipeDraft[]> {
  const { index, names } = await getVocab();
  const res = await extractRecipes(src, names);
  const drafts: RecipeDraft[] = [];
  for (const r of res.recipes) {
    // Link each recipe to the images it came from (falls back to all).
    const imgIds = meta.imageOriginalIds ?? [];
    const own = r.source_images.map((n) => imgIds[n - 1]).filter(Boolean);
    const originalIds = own.length ? own : meta.originalIds;
    const { draft, learned } = draftFromExtraction(r, {
      index,
      sourceType: meta.sourceType,
      sourceUrl: meta.sourceUrl ?? null,
      sourceNote: meta.sourceNote ?? null,
      originalIds,
      warnings: [`Extracted by Claude.`, ...res.warnings],
    });
    await rememberSynonyms(learned, "claude");
    drafts.push(draft);
  }
  return drafts;
}

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------

export async function importFromUrl(rawUrl: string): Promise<string> {
  const url = new URL(rawUrl.trim()).toString();
  const page = await fetchPage(url);
  const original = await saveUrlOriginal(page.finalUrl);
  const lds = extractJsonLdRecipes(page.html, page.finalUrl);
  if (lds.length) {
    const drafts = await Promise.all(
      lds.map(async (ld) => {
        // Keep the page's food photo (shown on recipe cards). Optional.
        const img = ld.imageUrl ? await fetchImage(ld.imageUrl) : null;
        const photo = img ? await saveUpload(img, "image").catch(() => null) : null;
        return draftFromLd(ld, page.finalUrl, photo ? [photo.id, original.id] : [original.id]);
      }),
    );
    const ids = [...new Set(drafts.flatMap((d) => d.originalIds))];
    return createBatch("url", ids, drafts);
  }
  if (!aiAvailable()) {
    throw new Error("No schema.org Recipe data on that page, and Claude is not configured (ANTHROPIC_API_KEY) for the text fallback.");
  }
  const { title, text } = pageText(page.html);
  const drafts = await draftsViaClaude(
    { kind: "text", text, hint: `Web page: ${page.finalUrl}\nPage title: ${title}` },
    { sourceType: "url", sourceUrl: page.finalUrl, sourceNote: new URL(page.finalUrl).hostname, originalIds: [original.id] },
  );
  if (!drafts.length) throw new Error("Claude found no recipe on that page.");
  return createBatch("url", [original.id], drafts, "No schema.org data; extracted from page text by Claude.");
}

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function importFromImages(originalIds: string[]): Promise<string> {
  if (!originalIds.length) throw new Error("Add at least one photo.");
  if (!aiAvailable()) throw new AiUnavailableError();
  const images: ImageInput[] = [];
  for (const id of originalIds) {
    const o = await readOriginal(id);
    if (!o?.data) throw new Error("An uploaded photo could not be read back from storage.");
    const mediaType = (o.row.mime ?? "image/jpeg") as ImageInput["mediaType"];
    if (!IMAGE_TYPES.has(mediaType)) throw new Error(`Unsupported image type ${mediaType}. Use JPEG, PNG or WebP.`);
    images.push({ data: o.data.toString("base64"), mediaType });
  }
  const drafts = await draftsViaClaude(
    { kind: "images", images },
    { sourceType: "photo", sourceNote: "Photo / scan", originalIds, imageOriginalIds: originalIds },
  );
  if (!drafts.length) throw new Error("Claude found no recipe in those photos.");
  return createBatch("photo", originalIds, drafts);
}

export async function importFromFile(originalId: string): Promise<string> {
  const o = await readOriginal(originalId);
  if (!o?.data) throw new Error("The uploaded file could not be read back from storage.");
  const filename = o.row.filename ?? "file";
  const kind = detectFileKind(filename, o.row.mime ?? "");
  const sourceNote = filename;
  if (kind === "image") return importFromImages([originalId]);
  if (kind === "unsupported") throw new Error("Unsupported file type. Use PDF, .docx, .txt or .md.");

  if (aiAvailable()) {
    try {
      const src: RecipeSource =
        kind === "pdf"
          ? { kind: "pdf", data: o.data.toString("base64"), filename }
          : { kind: "text", text: kind === "docx" ? await docxToText(o.data) : o.data.toString("utf8"), hint: `File: ${filename}` };
      const drafts = await draftsViaClaude(src, { sourceType: "file", sourceNote, originalIds: [originalId] });
      if (drafts.length) return createBatch("file", [originalId], drafts);
      throw new Error("Claude found no recipes in that file.");
    } catch (e) {
      if (!(e instanceof AiUnavailableError)) throw new Error(describeAiError(e));
    }
  }
  const text = kind === "pdf" ? await pdfToText(o.data) : kind === "docx" ? await docxToText(o.data) : o.data.toString("utf8");
  const found = splitRecipesFromText(text);
  if (!found.length) throw new Error("No recipes recognised in that file. Try manual entry, or configure Claude.");
  const drafts = await Promise.all(found.map((tr) => draftFromText(tr, "file", sourceNote, [originalId])));
  return createBatch("file", [originalId], drafts, "Parsed locally (no Claude).");
}

export async function importManual(): Promise<string> {
  return createBatch("manual", [], [{ ...emptyDraft("manual"), title: "" }]);
}

// ---------------------------------------------------------------------------
// Review
// ---------------------------------------------------------------------------

export async function getBatch(batchId: string) {
  const db = await getDb();
  const [batch] = await db.select().from(schema.importBatches).where(eq(schema.importBatches.id, batchId));
  if (!batch) return null;
  const drafts = await db
    .select()
    .from(schema.importDrafts)
    .where(eq(schema.importDrafts.batchId, batchId))
    .orderBy(asc(schema.importDrafts.position));
  const originals = await getOriginals(batch.originalIds);
  return { batch, drafts: drafts.map((d) => ({ ...d, draft: d.draft as RecipeDraft })), originals };
}

export async function saveDraft(draftId: string, draft: RecipeDraft): Promise<string> {
  const parsed = recipeDraftSchema.parse(draft);
  const db = await getDb();
  const [row] = await db.select().from(schema.importDrafts).where(eq(schema.importDrafts.id, draftId));
  if (!row) throw new Error("Draft not found.");
  const recipeId = await saveRecipe(parsed, row.recipeId ?? undefined);
  await db.update(schema.importDrafts).set({ status: "saved", draft: parsed, recipeId }).where(eq(schema.importDrafts.id, draftId));
  return recipeId;
}

export async function discardDraft(draftId: string) {
  const db = await getDb();
  await db.update(schema.importDrafts).set({ status: "discarded" }).where(eq(schema.importDrafts.id, draftId));
}

/** Re-normalize one ingredient name (used by the review editor when you type a new name). */
export async function suggestNormalization(name: string) {
  const m = await normalizeMany([name]);
  return m.get(name)!;
}
