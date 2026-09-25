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

function findProduct(node) {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const hit = findProduct(n);
      if (hit) return hit;
    }
    return null;
  }
  const type = node["@type"];
  if (type === "Product" || (Array.isArray(type) && type.includes("Product"))) return node;
  return findProduct(node["@graph"]);
}

const meta = (html, prop) => html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)["']`, "i"))?.[1] ?? null;

const decode = (s) =>
  s == null ? null : s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();

const eanOf = (s) => (s && /^\d{8,14}$/.test(String(s).trim()) ? String(s).trim() : null);

/**
 * Product facts in the shape POST /api/helper/products expects, or null when
 * the page doesn't identify a product.
 */
export function parseProductPage(html, url) {
  const ld = findProduct(jsonLdBlocks(html));
  const urlEan = String(url ?? "").match(/(?:^|[^\d])(\d{13}|\d{8})(?:[^\d]|$)/)?.[1] ?? null;
  const name = decode(ld?.name ?? meta(html, "og:title") ?? html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? null);
  if (!name) return null;
  const ean = eanOf(ld?.gtin13) ?? eanOf(ld?.gtin) ?? eanOf(ld?.gtin14) ?? eanOf(ld?.gtin8) ?? eanOf(ld?.productID) ?? eanOf(ld?.sku) ?? urlEan;
  const externalId = String(ld?.sku ?? ld?.productID ?? ean ?? "").trim() || null;
  if (!ean && !externalId) return null;
  const brand = decode(typeof ld?.brand === "string" ? ld.brand : (ld?.brand?.name ?? null));
  const offer = Array.isArray(ld?.offers) ? ld.offers[0] : ld?.offers;
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
