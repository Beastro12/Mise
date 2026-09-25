// Read product facts from an S-kaupat product page.
//
// STATUS: UNVERIFIED for s-kaupat.fi. It reads schema.org Product data
// (<script type="application/ld+json">), the standard most web shops publish
// for search engines, and falls back to the page title and an EAN in the URL.
// Nothing here is specific to an S-kaupat API. If the real page carries no
// JSON-LD, the helper tells you it couldn't read the product and skips it.

/** Canonical units Aitta understands for pack sizes (subset of src/lib/domain/units.ts). */
const PACK_UNITS = { g: "g", kg: "kg", ml: "ml", cl: "cl", dl: "dl", l: "l", kpl: "kpl", rl: "kpl", rll: "kpl", "rulla": "kpl" };

const num = (s) => {
  if (s == null || String(s).trim() === "") return null;
  const n = Number(String(s).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/**
 * Pack size from a Finnish product name: "Valio kuohukerma 2 dl" → {2, dl};
 * "Coca-Cola 6 x 330 ml" → {1980, ml}; "Lotus WC-paperi 8 rl" → {8, kpl}.
 * Uses the last size in the name. Returns null when there is none.
 */
export function packFromName(name) {
  const unit = "(kg|g|ml|cl|dl|l|kpl|rl|rll|rulla)";
  const multi = [...String(name).matchAll(new RegExp(`(\\d+)\\s*[x×]\\s*(\\d+(?:[.,]\\d+)?)\\s*${unit}(?![a-zåäö])`, "gi"))].pop();
  if (multi) {
    const size = num(multi[1]) * num(multi[2]);
    return { packSize: Math.round(size * 1000) / 1000, packUnit: PACK_UNITS[multi[3].toLowerCase()] };
  }
  const single = [...String(name).matchAll(new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*${unit}(?![a-zåäö])`, "gi"))].pop();
  if (!single) return null;
  return { packSize: num(single[1]), packUnit: PACK_UNITS[single[2].toLowerCase()] };
}

function jsonLdBlocks(html) {
  const out = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(re)) {
    try {
      out.push(JSON.parse(m[1].trim()));
    } catch {
      // ignore malformed blocks
    }
  }
  return out;
}

function collectProducts(node, out = []) {
  if (!node || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const n of node) collectProducts(n, out);
    return out;
  }
  const type = node["@type"];
  if (type === "Product" || (Array.isArray(type) && type.includes("Product"))) out.push(node);
  collectProducts(node["@graph"], out);
  return out;
}

const samePage = (a, b) => {
  try {
    const x = new URL(a);
    const y = new URL(b);
    return x.host === y.host && x.pathname.replace(/\/$/, "") === y.pathname.replace(/\/$/, "");
  } catch {
    return false;
  }
};

/**
 * The page's own Product. Pages often also carry "related products" as
 * Product nodes, so prefer the one whose url/@id is this page, then one with
 * an offer and a GTIN, and only then the first.
 */
function findProduct(blocks, pageUrl) {
  const all = collectProducts(blocks);
  return (
    all.find((p) => pageUrl && (samePage(p.url, pageUrl) || samePage(p["@id"], pageUrl))) ??
    all.find((p) => p.offers && (p.gtin13 || p.gtin || p.gtin8 || p.gtin14)) ??
    all[0] ??
    null
  );
}

const meta = (html, prop) => html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)["']`, "i"))?.[1] ?? null;

const decode = (s) =>
  s == null ? null : s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();

/** GS1 check digit: the last digit makes the weighted sum (3,1,3,1… from the right) a multiple of 10. */
export function validGtin(code) {
  if (!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(code)) return false;
  const digits = [...code].map(Number);
  const check = digits.pop();
  const sum = digits.reverse().reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

const eanOf = (s) => {
  const v = s == null ? "" : String(s).trim();
  return validGtin(v) ? v : null;
};

/**
 * Product facts in the shape POST /api/helper/products expects, or null when
 * the page doesn't identify a product.
 */
export function parseProductPage(html, url) {
  const ld = findProduct(jsonLdBlocks(html), url);
  const urlEan = eanOf(String(url ?? "").match(/(?:^|[^\d])(\d{13}|\d{8})(?:[^\d]|$)/)?.[1]);
  const name = decode(ld?.name ?? meta(html, "og:title") ?? html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? null);
  if (!name) return null;
  const ean = eanOf(ld?.gtin13) ?? eanOf(ld?.gtin) ?? eanOf(ld?.gtin14) ?? eanOf(ld?.gtin8) ?? eanOf(ld?.productID) ?? eanOf(ld?.sku) ?? urlEan;
  const externalId = String(ld?.sku ?? ld?.productID ?? ean ?? "").trim() || null;
  if (!ean && !externalId) return null;
  const brand = decode(typeof ld?.brand === "string" ? ld.brand : (ld?.brand?.name ?? null));
  const offers = Array.isArray(ld?.offers) ? ld.offers : ld?.offers ? [ld.offers] : [];
  const offer = offers.find((o) => o?.price != null || o?.lowPrice != null);
  const price = num(offer?.price ?? offer?.lowPrice ?? meta(html, "product:price:amount") ?? "");
  const pack = packFromName(name);
  return {
    externalId,
    ean,
    name,
    brand,
    packSize: pack?.packSize ?? null,
    packUnit: pack?.packUnit ?? null,
    price: price ?? null,
    unitPrice: null,
    unitPriceUnit: null,
  };
}
