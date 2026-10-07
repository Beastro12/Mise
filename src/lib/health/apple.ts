/**
 * Apple Health export.xml → daily totals, streamed in chunks (exports are often
 * hundreds of MB, so this runs in the browser and only daily totals are sent).
 *
 * Health stores the same quantity from several sources (iPhone + Watch steps,
 * Oura writing active energy). Health itself de-duplicates by source priority;
 * we approximate that by summing per source and taking the largest source per
 * day, instead of adding sources together.
 */

export type DailyHealth = {
  day: string;
  activeKcal: number | null;
  basalKcal: number | null;
  totalKcal: number | null;
  steps: number | null;
  weightKg: number | null;
  intakeKcal: number | null;
};

const TYPES = {
  HKQuantityTypeIdentifierActiveEnergyBurned: "active",
  HKQuantityTypeIdentifierBasalEnergyBurned: "basal",
  HKQuantityTypeIdentifierStepCount: "steps",
  HKQuantityTypeIdentifierBodyMass: "weight",
  HKQuantityTypeIdentifierDietaryEnergyConsumed: "intake",
} as const;
type Kind = (typeof TYPES)[keyof typeof TYPES];

function attr(tag: string, name: string): string | null {
  const m = new RegExp(`\\s${name}="([^"]*)"`).exec(tag);
  return m ? m[1] : null;
}

function toKcal(value: number, unit: string | null): number {
  const u = (unit ?? "kcal").toLowerCase();
  if (u === "kj") return value / 4.184;
  if (u === "j") return value / 4184;
  return value; // kcal, Cal
}

function toKg(value: number, unit: string | null): number {
  const u = (unit ?? "kg").toLowerCase();
  if (u === "lb") return value * 0.45359237;
  if (u === "g") return value / 1000;
  if (u === "st") return value * 6.35029318;
  return value;
}

export class AppleHealthParser {
  private buf = "";
  /** day → kind → source → sum */
  private sums = new Map<string, Map<Kind, Map<string, number>>>();
  /** day → [timestamp, kg] of the latest weight */
  private weights = new Map<string, [string, number]>();
  records = 0;

  push(chunk: string) {
    this.buf += chunk;
    let pos = 0;
    for (;;) {
      const start = this.buf.indexOf("<Record ", pos);
      if (start < 0) {
        // Keep a short tail in case "<Record " is split across chunks.
        pos = Math.max(pos, this.buf.length - 8);
        break;
      }
      const end = this.buf.indexOf(">", start);
      if (end < 0) {
        pos = start;
        break;
      }
      this.record(this.buf.slice(start, end));
      pos = end + 1;
    }
    this.buf = this.buf.slice(pos);
  }

  private record(tag: string) {
    const type = attr(tag, "type");
    const kind = type ? TYPES[type as keyof typeof TYPES] : undefined;
    if (!kind) return;
    const value = parseFloat(attr(tag, "value") ?? "");
    const startDate = attr(tag, "startDate");
    if (!Number.isFinite(value) || !startDate) return;
    // "2026-09-01 08:00:00 +0300": the phone's local date is the first 10 chars.
    const day = startDate.slice(0, 10);
    this.records++;
    const unit = attr(tag, "unit");
    if (kind === "weight") {
      const prev = this.weights.get(day);
      if (!prev || startDate > prev[0]) this.weights.set(day, [startDate, toKg(value, unit)]);
      return;
    }
    const v = kind === "steps" ? value : toKcal(value, unit);
    const source = attr(tag, "sourceName") ?? "?";
    let byKind = this.sums.get(day);
    if (!byKind) this.sums.set(day, (byKind = new Map()));
    let bySource = byKind.get(kind);
    if (!bySource) byKind.set(kind, (bySource = new Map()));
    bySource.set(source, (bySource.get(source) ?? 0) + v);
  }

  /** Daily totals, newest first, optionally only days on/after `since`. */
  result(since?: string): DailyHealth[] {
    const days = new Set([...this.sums.keys(), ...this.weights.keys()]);
    const out: DailyHealth[] = [];
    for (const day of days) {
      if (since && day < since) continue;
      const byKind = this.sums.get(day);
      const best = (k: Kind) => {
        const s = byKind?.get(k);
        return s && s.size ? Math.round(Math.max(...s.values())) : null;
      };
      const w = this.weights.get(day);
      out.push({
        day,
        activeKcal: best("active"),
        basalKcal: best("basal"),
        totalKcal: null,
        steps: best("steps"),
        weightKg: w ? Math.round(w[1] * 10) / 10 : null,
        intakeKcal: best("intake"),
      });
    }
    return out.sort((a, b) => (a.day < b.day ? 1 : -1));
  }
}

/** Parse a whole export from a stream of text chunks. */
export async function parseAppleHealthStream(chunks: AsyncIterable<string> | ReadableStream<string>, since?: string): Promise<{ days: DailyHealth[]; records: number }> {
  const p = new AppleHealthParser();
  for await (const c of chunks as AsyncIterable<string>) p.push(c);
  return { days: p.result(since), records: p.records };
}
