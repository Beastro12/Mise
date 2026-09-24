import { convert, formatQty, round } from "./units";
import type { AggregatedLine } from "./aggregate";

export type PantryEntry = { nameFi: string; quantity: number | null; unit: string | null; note?: string | null };

export type LineState = "none" | "ask" | "covered";

export type PantryAdjustedLine = AggregatedLine & { state: LineState };

/**
 * Subtract what is already at home.
 * - Pantry item without quantity → line is covered.
 * - Compatible quantity → subtract; covered if nothing remains.
 * - Incompatible units → keep the line, annotate it.
 */
export function subtractPantry(lines: AggregatedLine[], pantry: PantryEntry[]): PantryAdjustedLine[] {
  const byName = new Map(pantry.map((p) => [p.nameFi, p]));
  return lines.map((line) => {
    const p = byName.get(line.nameFi);
    if (!p) return { ...line, state: "none" as const };
    const have = p.quantity != null ? formatQty({ quantity: p.quantity, unit: p.unit }) : p.note || "some";
    if (p.quantity == null || line.quantity == null) {
      return { ...line, state: "covered" as const, notes: [...line.notes, `in pantry (${have})`] };
    }
    const haveInLineUnit = convert(p.quantity, p.unit, line.unit);
    if (haveInLineUnit == null) {
      return { ...line, state: "none" as const, notes: [...line.notes, `pantry has ${have}`] };
    }
    const remaining = round(line.quantity - haveInLineUnit, 2);
    if (remaining <= 0) {
      return { ...line, state: "covered" as const, notes: [...line.notes, `in pantry (${have})`] };
    }
    return {
      ...line,
      quantity: remaining,
      state: "none" as const,
      notes: [...line.notes, `pantry has ${have}, buying the rest`],
    };
  });
}

/** Staples not covered by the pantry become "have it?" questions. */
export function markStaples(lines: PantryAdjustedLine[], staples: Set<string>): PantryAdjustedLine[] {
  return lines.map((l) => (l.state === "none" && staples.has(l.nameFi) ? { ...l, state: "ask" as const } : l));
}
