/**
 * Local parser for pasted leaflet text (no AI). One offer per line, e.g.
 *   "Kermaviili 10 % 200 g 0,49 €"
 *   "Tuore lohifilee 400 g — 5,99"
 *   "Jauheliha 400 g 2.99€ (7,48 €/kg)"
 */
export type ParsedOfferLine = {
  productName: string;
  price: number;
  unitText: string | null;
  unitPrice: number | null;
  unitPriceUnit: "kg" | "l" | "kpl" | null;
};

const PRICE = String.raw`(\d{1,3})[,.](\d{2})`;
const UNIT_PRICE_RE = new RegExp(String.raw`\(?\s*${PRICE}\s*€?\s*\/\s*(kg|l|kpl)\s*\)?`, "i");
const PRICE_RE = new RegExp(String.raw`${PRICE}\s*(?:€|e|eur)?`, "gi");
const SIZE_RE = /(\d+(?:[.,]\d+)?\s*(?:x\s*\d+(?:[.,]\d+)?\s*)?(?:kg|g|ml|dl|cl|l|kpl))\b/i;

export function parseOfferLines(text: string): ParsedOfferLine[] {
  const out: ParsedOfferLine[] = [];
  for (const raw of text.split(/\r?\n/)) {
    let line = raw.trim();
    if (!line) continue;
    let unitPrice: number | null = null;
    let unitPriceUnit: ParsedOfferLine["unitPriceUnit"] = null;
    const up = line.match(UNIT_PRICE_RE);
    if (up) {
      unitPrice = Number(`${up[1]}.${up[2]}`);
      unitPriceUnit = up[3].toLowerCase() as "kg" | "l" | "kpl";
      line = line.replace(up[0], " ");
    }
    const prices = [...line.matchAll(PRICE_RE)];
    if (!prices.length) continue;
    // The offer price is the last price on the line.
    const last = prices[prices.length - 1];
    const price = Number(`${last[1]}.${last[2]}`);
    const before = line.slice(0, last.index).replace(/[-–—:|]+\s*$/, "").trim();
    if (!before) continue;
    const size = before.match(SIZE_RE);
    out.push({
      productName: before.replace(/\s+/g, " "),
      price,
      unitText: size ? size[1].replace(/\s+/g, " ") : null,
      unitPrice,
      unitPriceUnit,
    });
  }
  return out;
}
