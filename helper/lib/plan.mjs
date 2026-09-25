// Pure logic for the S-kaupat cart helper (no browser). Unit-tested in tests/unit/helper.test.ts.

/**
 * Turn the app's order feed into cart steps: what to search for, how many,
 * and the fallback. Items without any product reference are reported.
 * @param {any} order - JSON from /api/share/<token>/order
 */
export function planCart(order) {
  const steps = [];
  const missing = [...(order.unmapped ?? []).map((u) => ({ ingredient: u.ingredient, reason: "no product matched in Aitta" }))];
  for (const it of order.items ?? []) {
    const choices = [it.primary, order.delivery?.substitutions === "none" ? null : it.alternate].filter(Boolean).map((p) => ({
      ...p,
      query: p.ean || p.s_kaupat_product_id || p.name,
      mock: p.source === "mock",
    }));
    const real = choices.filter((c) => !c.mock);
    if (!real.length) {
      missing.push({ ingredient: it.ingredient, reason: choices.length ? "only MOCK products matched (not real S-kaupat items)" : "no product" });
      continue;
    }
    steps.push({ ingredient: it.ingredient, quantity: Math.max(1, Math.round(it.quantity ?? 1)), choices: real });
  }
  return { steps, missing };
}

const WEEKDAYS = [
  ["ma", "maanantai", "mon", "monday"],
  ["ti", "tiistai", "tue", "tuesday"],
  ["ke", "keskiviikko", "wed", "wednesday"],
  ["to", "torstai", "thu", "thursday"],
  ["pe", "perjantai", "fri", "friday"],
  ["la", "lauantai", "sat", "saturday"],
  ["su", "sunnuntai", "sun", "sunday"],
];

const toMin = (h, m) => Number(h) * 60 + Number(m ?? 0);

/**
 * Parse a delivery slot label such as "La 27.9. 10.00–12.00" or
 * "lauantai klo 10–12" → { weekday: 1..7|null, start, end } in minutes.
 */
export function parseSlot(label) {
  const l = label.toLowerCase().replace(/\s+/g, " ");
  let weekday = null;
  for (let i = 0; i < WEEKDAYS.length && weekday == null; i++) {
    for (const w of WEEKDAYS[i]) {
      if (new RegExp(`(^|[^a-zäö])${w}([^a-zäö]|$)`).test(l)) {
        weekday = i + 1;
        break;
      }
    }
  }
  const m = l.match(/(\d{1,2})(?:[.:](\d{2}))?\s*[-–—]\s*(\d{1,2})(?:[.:](\d{2}))?/g);
  // Prefer a range that looks like hours (not a date like 27.9.)
  let start = null;
  let end = null;
  for (const r of m ?? []) {
    const p = r.match(/(\d{1,2})(?:[.:](\d{2}))?\s*[-–—]\s*(\d{1,2})(?:[.:](\d{2}))?/);
    const s = toMin(p[1], p[2]);
    const e = toMin(p[3], p[4]);
    if (e > s && Number(p[1]) <= 23 && Number(p[3]) <= 24) {
      start = s;
      end = e;
      break;
    }
  }
  return { weekday, start, end };
}

/**
 * Pick a slot: first one on the preferred weekday overlapping the preferred
 * window; else the first slot on that weekday; else the first slot at all.
 * @param {string[]} labels - visible slot labels in page order
 * @param {{weekday:number, windowStart:string, windowEnd:string}} pref
 */
export function chooseSlot(labels, pref) {
  const [ws, we] = [pref.windowStart, pref.windowEnd].map((t) => {
    const [h, m] = t.split(":");
    return toMin(h, m);
  });
  const parsed = labels.map((label, index) => ({ label, index, ...parseSlot(label) }));
  const sameDay = parsed.filter((p) => p.weekday === pref.weekday);
  const inWindow = sameDay.find((p) => p.start != null && p.end != null && p.start < we && p.end > ws);
  if (inWindow) return { ...inWindow, match: "preferred" };
  if (sameDay[0]) return { ...sameDay[0], match: "same day, other time" };
  if (parsed[0]) return { ...parsed[0], match: "earliest available" };
  return null;
}

/** Buttons the helper must never press: placing or paying for the order is yours. */
export const FORBIDDEN_CLICK = /(vahvista|lähetä|tee)\s*tilaus|tilaa( nyt)?$|^tilaa|maksa|siirry maksamaan|place order|confirm order|pay now|checkout and pay/i;

export function isForbidden(text) {
  return FORBIDDEN_CLICK.test((text ?? "").trim());
}
