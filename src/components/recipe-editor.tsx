"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { IngredientDraft, RecipeDraft } from "@/lib/domain/recipe-draft";
import { SECTIONS } from "@/lib/domain/sections";
import { CANONICAL_UNITS } from "@/lib/domain/units";
import { discardDraftAction, normalizeNameAction, parseLinesAction, saveDraftAction, saveRecipeAction } from "@/app/actions/recipes";
import { Button, Field, Notice, btn, cx, inputCls } from "./ui";

type Mode = { kind: "draft"; draftId: string; status: "pending" | "saved" | "discarded"; recipeId?: string | null } | { kind: "recipe"; recipeId: string };

const smallInput = "rounded-md border border-line bg-surface px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40";

function numOrNull(v: string): number | null {
  const s = v.replace(",", ".").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

type Row = IngredientDraft & { _k: string; _q: string };
let keySeq = 0;
const toRow = (i: IngredientDraft): Row => ({ ...i, _k: `k${keySeq++}`, _q: i.quantity == null ? "" : String(i.quantity).replace(".", ",") });

type EditorState = Omit<RecipeDraft, "ingredients"> & { ingredients: Row[] };

export function RecipeEditor({ initial, mode, index }: { initial: RecipeDraft; mode: Mode; index?: number }) {
  const router = useRouter();
  const [d, setD] = useState<EditorState>(() => ({ ...initial, ingredients: initial.ingredients.map(toRow) }));
  const [tagsText, setTagsText] = useState(initial.tags.join(", "));
  const [stepsText, setStepsText] = useState(initial.steps.join("\n"));
  const [status, setStatus] = useState(mode.kind === "draft" ? mode.status : "pending");
  const [savedId, setSavedId] = useState<string | null>(mode.kind === "draft" ? (mode.recipeId ?? null) : mode.recipeId);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [newLines, setNewLines] = useState("");
  const [open, setOpen] = useState(mode.kind === "recipe" || status === "pending");

  const set = <K extends keyof EditorState>(k: K, v: EditorState[K]) => setD((x) => ({ ...x, [k]: v }));
  const setIng = (i: number, patch: Partial<Row>) =>
    setD((x) => ({ ...x, ingredients: x.ingredients.map((ing, j) => (j === i ? { ...ing, ...patch } : ing)) }));
  const removeIng = (i: number) => setD((x) => ({ ...x, ingredients: x.ingredients.filter((_, j) => j !== i) }));
  const moveIng = (i: number, dir: -1 | 1) =>
    setD((x) => {
      const arr = [...x.ingredients];
      const j = i + dir;
      if (j < 0 || j >= arr.length) return x;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return { ...x, ingredients: arr };
    });

  function addLines() {
    const lines = newLines.split("\n").filter((l) => l.trim());
    if (!lines.length) return;
    start(async () => {
      const parsed = await parseLinesAction(lines);
      setD((x) => ({ ...x, ingredients: [...x.ingredients, ...parsed.map(toRow)] }));
      setNewLines("");
    });
  }

  function renormalize(i: number) {
    const name = d.ingredients[i].name;
    start(async () => {
      const r = await normalizeNameAction(name);
      setIng(i, { nameFi: r.nameFi, category: r.category });
    });
  }

  function save() {
    setError(null);
    const clean: RecipeDraft = {
      ...d,
      title: d.title.trim(),
      tags: tagsText
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
      ingredients: d.ingredients
        .filter((i) => i.name.trim())
        .map(({ _k, _q, ...i }) => {
          void _k;
          const quantity = numOrNull(_q);
          return { ...i, quantity, nameFi: (i.nameFi || i.name).trim().toLowerCase(), unit: quantity == null ? null : (i.unit ?? "kpl") };
        }),
      steps: stepsText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    };
    if (!clean.title) return setError("Title is required.");
    if (!clean.servings || clean.servings < 1) return setError("Servings must be at least 1.");
    start(async () => {
      const res = mode.kind === "draft" ? await saveDraftAction(mode.draftId, clean) : await saveRecipeAction(mode.recipeId, clean);
      if (!res.ok) return setError(res.error);
      if (mode.kind === "recipe") {
        router.push(`/recipes/${res.data}`);
        router.refresh();
      } else {
        setStatus("saved");
        setSavedId(res.data ?? null);
        setOpen(false);
      }
    });
  }

  function discard() {
    if (mode.kind !== "draft") return;
    start(async () => {
      await discardDraftAction(mode.draftId);
      setStatus("discarded");
      setOpen(false);
    });
  }

  const header = (
    <div className="flex items-center justify-between gap-2">
      <button type="button" onClick={() => setOpen((o) => !o)} className="min-w-0 flex-1 text-left">
        <div className="text-xs text-muted">{index != null ? `Recipe ${index + 1}` : "Recipe"}</div>
        <div className="truncate font-semibold">{d.title || "Untitled"}</div>
      </button>
      {status === "saved" ? (
        <a href={`/recipes/${savedId}`} className={btn.small} data-testid="saved-link">
          Saved ✓ View
        </a>
      ) : status === "discarded" ? (
        <span className="text-xs text-muted">Discarded</span>
      ) : null}
    </div>
  );

  return (
    <div className="rounded-lg border border-line bg-surface p-4" data-testid="recipe-editor">
      {mode.kind === "draft" ? header : null}
      {!open ? null : (
        <div className={cx("space-y-4", mode.kind === "draft" && "mt-4")}>
          {d.warnings?.length ? (
            <Notice>
              <ul className="list-disc pl-4">
                {d.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </Notice>
          ) : null}

          <Field label="Title">
            <input className={inputCls} value={d.title} onChange={(e) => set("title", e.target.value)} name="title" />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Servings">
              <input className={inputCls} inputMode="numeric" value={d.servings} onChange={(e) => set("servings", parseInt(e.target.value, 10) || 0)} />
            </Field>
            <Field label="Prep min">
              <input className={inputCls} inputMode="numeric" value={d.prepMinutes ?? ""} onChange={(e) => set("prepMinutes", numOrNull(e.target.value))} />
            </Field>
            <Field label="Cook min">
              <input className={inputCls} inputMode="numeric" value={d.cookMinutes ?? ""} onChange={(e) => set("cookMinutes", numOrNull(e.target.value))} />
            </Field>
          </div>

          <Field label="Tags" hint="Comma separated, e.g. arki, quick, kala, vegetarian">
            <input className={inputCls} value={tagsText} onChange={(e) => setTagsText(e.target.value)} />
          </Field>

          <div>
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-sm font-medium">Ingredients</span>
              <span className="text-xs text-muted">qty · unit · name as written · Finnish name · section</span>
            </div>
            <ul className="space-y-2">
              {d.ingredients.map((ing, i) => (
                <li key={ing._k} className="rounded-lg border border-line bg-bg p-2" data-testid="ingredient-row">
                  <div className="flex gap-1.5">
                    <input
                      aria-label="Quantity"
                      className={cx(smallInput, "w-16 tabular")}
                      inputMode="decimal"
                      value={ing._q}
                      onChange={(e) => setIng(i, { _q: e.target.value })}
                    />
                    <select aria-label="Unit" className={cx(smallInput, "w-24")} value={ing.unit ?? ""} onChange={(e) => setIng(i, { unit: e.target.value || null })}>
                      <option value="">–</option>
                      {CANONICAL_UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                    <input aria-label="Name" className={cx(smallInput, "min-w-0 flex-1")} value={ing.name} onChange={(e) => setIng(i, { name: e.target.value })} />
                  </div>
                  <div className="mt-1.5 flex gap-1.5">
                    <input
                      aria-label="Finnish name"
                      className={cx(smallInput, "min-w-0 flex-1 font-medium")}
                      value={ing.nameFi}
                      onChange={(e) => setIng(i, { nameFi: e.target.value })}
                    />
                    <button type="button" title="Re-normalize from name" className={btn.small} onClick={() => renormalize(i)}>
                      ↻ fi
                    </button>
                    <select aria-label="Section" className={cx(smallInput, "w-32")} value={ing.category} onChange={(e) => setIng(i, { category: e.target.value })}>
                      {SECTIONS.map((s) => (
                        <option key={s.key} value={s.key}>
                          {s.fi}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <input
                      aria-label="Prep note"
                      placeholder="prep note"
                      className={cx(smallInput, "min-w-0 flex-1")}
                      value={ing.prepNote ?? ""}
                      onChange={(e) => setIng(i, { prepNote: e.target.value || null })}
                    />
                    <label className="flex items-center gap-1 text-xs text-muted">
                      <input type="checkbox" checked={ing.optional} onChange={(e) => setIng(i, { optional: e.target.checked })} /> optional
                    </label>
                    <button type="button" className={btn.small} onClick={() => moveIng(i, -1)} aria-label="Move up">
                      ↑
                    </button>
                    <button type="button" className={btn.small} onClick={() => moveIng(i, 1)} aria-label="Move down">
                      ↓
                    </button>
                    <button type="button" className={cx(btn.small, "text-danger")} onClick={() => removeIng(i)} aria-label="Remove">
                      ✕
                    </button>
                  </div>
                  {ing.originalText && ing.originalText !== ing.name ? <div className="mt-1 text-xs text-muted">Original: {ing.originalText}</div> : null}
                </li>
              ))}
            </ul>
            <div className="mt-2 space-y-1.5">
              <textarea
                className={inputCls}
                rows={2}
                placeholder={"Add ingredient lines, e.g.\n2 dl kermaa\n1 cup sour cream"}
                value={newLines}
                onChange={(e) => setNewLines(e.target.value)}
                data-testid="add-lines"
              />
              <Button type="button" variant="secondary" onClick={addLines} disabled={pending || !newLines.trim()}>
                + Add ingredients
              </Button>
            </div>
          </div>

          <Field label="Steps" hint="One step per line">
            <textarea
              className={inputCls}
              rows={Math.min(12, Math.max(4, stepsText.split("\n").length + 1))}
              value={stepsText}
              onChange={(e) => setStepsText(e.target.value)}
            />
          </Field>

          <Field label="Notes">
            <textarea className={inputCls} rows={2} value={d.notes ?? ""} onChange={(e) => set("notes", e.target.value || null)} />
          </Field>

          {d.sourceUrl ? (
            <p className="text-xs text-muted">
              Source:{" "}
              <a className="underline" href={d.sourceUrl} target="_blank" rel="noreferrer">
                {d.sourceUrl}
              </a>
            </p>
          ) : null}

          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <div className="flex gap-2">
            <Button type="button" onClick={save} disabled={pending} data-testid="save-recipe">
              {pending ? "Saving…" : mode.kind === "draft" ? "Save recipe" : "Save changes"}
            </Button>
            {mode.kind === "draft" && status === "pending" ? (
              <Button type="button" variant="ghost" onClick={discard} disabled={pending}>
                Discard
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
