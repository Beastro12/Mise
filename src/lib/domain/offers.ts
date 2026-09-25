export type OfferInfo = {
  id: string;
  productName: string;
  nameFi: string;
  price: number;
  unitPrice: number | null;
  unitPriceUnit: string | null;
  unitText: string | null;
  validFrom: string; // YYYY-MM-DD
  validTo: string; // YYYY-MM-DD
};

export function isActive(offer: Pick<OfferInfo, "validFrom" | "validTo">, today: string): boolean {
  return offer.validFrom <= today && today <= offer.validTo;
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whole-word (Finnish letters aware) containment. */
export function containsWord(haystack: string, word: string): boolean {
  if (!word) return false;
  const re = new RegExp(`(^|[^a-zåäö0-9])${escapeRe(word.toLowerCase())}([^a-zåäö0-9]|$)`, "i");
  return re.test(haystack.toLowerCase());
}

export function offerMatches(offer: Pick<OfferInfo, "nameFi" | "productName">, nameFi: string): boolean {
  if (!nameFi) return false;
  if (offer.nameFi.toLowerCase() === nameFi.toLowerCase()) return true;
  return containsWord(offer.productName, nameFi);
}

/** Cheapest active offer matching the ingredient. */
export function findOffer(nameFi: string, offers: OfferInfo[], today: string): OfferInfo | null {
  let best: OfferInfo | null = null;
  for (const o of offers) {
    if (!isActive(o, today) || !offerMatches(o, nameFi)) continue;
    if (!best || o.price < best.price) best = o;
  }
  return best;
}

export function formatPrice(n: number): string {
  return `${n.toFixed(2).replace(".", ",")} €`;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parseDate(d: string): Date {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / 86_400_000);
}

/** "until Sun" within the coming week, otherwise "until 3.10." */
export function formatUntil(validTo: string, today: string): string {
  const d = parseDate(validTo);
  const diff = daysBetween(today, validTo);
  if (diff >= 0 && diff <= 6) return `until ${WEEKDAYS[d.getUTCDay()]}`;
  return `until ${d.getUTCDate()}.${d.getUTCMonth() + 1}.`;
}

export function addDays(date: string, days: number): string {
  const d = parseDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Monday of the ISO week containing the date. */
export function mondayOf(date: string): string {
  const d = parseDate(date);
  const dow = (d.getUTCDay() + 6) % 7; // Mon=0
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

/** Today's date in Europe/Helsinki as YYYY-MM-DD. */
export function todayHelsinki(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Helsinki", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
