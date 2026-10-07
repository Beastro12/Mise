/**
 * Oura daily activity → daily totals. Accepts:
 *  - the API v2 shape `{ "data": [{ "day", "total_calories", "active_calories", "steps" }] }`
 *  - a data export JSON with a `daily_activity` (v2) or `activity` (v1) array
 *  - CSV with a header row: day|date|summary_date, total_calories|cal_total,
 *    active_calories|cal_active, steps (other columns are ignored)
 * Oura's export file layout is not verified here, so column names are matched loosely.
 */
import type { DailyHealth } from "./apple";

const norm = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

const DAY = ["day", "date", "summary_date"];
const TOTAL = ["total_calories", "cal_total", "total_burn", "total_calorie_burn"];
const ACTIVE = ["active_calories", "cal_active", "active_burn", "active_calorie_burn"];
const STEPS = ["steps", "step_count"];

function pick(row: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) if (row[k] !== undefined && row[k] !== "") return row[k];
  return undefined;
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? Math.round(n) : null;
}

function toDaily(row: Record<string, unknown>): DailyHealth | null {
  const r = Object.fromEntries(Object.entries(row).map(([k, v]) => [norm(k), v]));
  const day = String(pick(r, DAY) ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const totalKcal = num(pick(r, TOTAL));
  const activeKcal = num(pick(r, ACTIVE));
  const steps = num(pick(r, STEPS));
  if (totalKcal == null && activeKcal == null && steps == null) return null;
  return { day, totalKcal, activeKcal, basalKcal: null, steps, weightKg: null, intakeKcal: null };
}

/** Split one CSV line, honouring double quotes. */
function csvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === sep) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const sep = [",", ";", "\t"].sort((a, b) => lines[0].split(b).length - lines[0].split(a).length)[0];
  const head = csvLine(lines[0], sep);
  return lines.slice(1).map((l) => {
    const cells = csvLine(l, sep);
    return Object.fromEntries(head.map((h, i) => [h, cells[i] ?? ""]));
  });
}

export function parseOura(text: string): DailyHealth[] {
  const t = text.replace(/^﻿/, "").trim();
  let rows: Record<string, unknown>[] = [];
  if (t.startsWith("{") || t.startsWith("[")) {
    const json = JSON.parse(t) as unknown;
    if (Array.isArray(json)) rows = json;
    else if (json && typeof json === "object") {
      const o = json as Record<string, unknown>;
      const arr = o.data ?? o.daily_activity ?? o.activity;
      if (Array.isArray(arr)) rows = arr;
    }
  } else {
    rows = parseCsv(t);
  }
  const byDay = new Map<string, DailyHealth>();
  for (const r of rows) {
    if (!r || typeof r !== "object") continue;
    const d = toDaily(r);
    if (d) byDay.set(d.day, d); // last row for a day wins
  }
  return [...byDay.values()].sort((a, b) => (a.day < b.day ? 1 : -1));
}
