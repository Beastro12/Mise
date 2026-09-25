import { addDays, daysBetween } from "./offers";

export type HouseholdLike = { intervalDays: number; lastBoughtOn: string | null; active: boolean };

/** Date the item is next expected to run out (null = never bought: due now). */
export function nextDue(item: Pick<HouseholdLike, "intervalDays" | "lastBoughtOn">): string | null {
  return item.lastBoughtOn ? addDays(item.lastBoughtOn, Math.max(1, item.intervalDays)) : null;
}

/**
 * Suggest a refill if it will run out before the next weekly shop
 * (within `horizonDays`), or has never been bought.
 */
export function isDue(item: HouseholdLike, today: string, horizonDays = 7): boolean {
  if (!item.active) return false;
  const due = nextDue(item);
  if (!due) return true;
  return daysBetween(today, due) <= horizonDays;
}

/** Common refills offered as one-tap suggestions on the household page. */
export const HOUSEHOLD_SUGGESTIONS: Array<{ name: string; nameFi: string; intervalDays: number; quantity: number | null; unit: string | null }> = [
  { name: "WC-paperi", nameFi: "wc-paperi", intervalDays: 21, quantity: 1, unit: "pkt" },
  { name: "Talouspaperi", nameFi: "talouspaperi", intervalDays: 30, quantity: 1, unit: "pkt" },
  { name: "Astianpesuaine", nameFi: "astianpesuaine", intervalDays: 45, quantity: 1, unit: "pullo" },
  { name: "Konetiskiaine", nameFi: "konetiskiaine", intervalDays: 45, quantity: 1, unit: "pkt" },
  { name: "Pyykinpesuaine", nameFi: "pyykinpesuaine", intervalDays: 45, quantity: 1, unit: "pullo" },
  { name: "Kahvi", nameFi: "kahvi", intervalDays: 14, quantity: 500, unit: "g" },
  { name: "Maito", nameFi: "maito", intervalDays: 4, quantity: 1, unit: "l" },
  { name: "Leipä", nameFi: "leipä", intervalDays: 5, quantity: 1, unit: "kpl" },
  { name: "Kananmunat", nameFi: "kananmuna", intervalDays: 10, quantity: 10, unit: "kpl" },
  { name: "Roskapussit", nameFi: "roskapussi", intervalDays: 60, quantity: 1, unit: "rs" },
];
