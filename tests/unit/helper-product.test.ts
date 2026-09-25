import { describe, expect, it } from "vitest";
import { packFromName, parseProductPage, validGtin } from "../../helper/lib/product.mjs";

describe("S-kaupat helper: pack size from the product name", () => {
  it("reads the last size in the name", () => {
    expect(packFromName("Valio kuohukerma 2 dl laktoositon")).toEqual({ packSize: 2, packUnit: "dl" });
    expect(packFromName("Peruna 1,5kg")).toEqual({ packSize: 1.5, packUnit: "kg" });
    expect(packFromName("WC-paperi 8 rl")).toEqual({ packSize: 8, packUnit: "kpl" });
    expect(packFromName("Kivennäisvesi 6 x 330 ml")).toEqual({ packSize: 1980, packUnit: "ml" });
    expect(packFromName("Kananmuna 10 kpl")).toEqual({ packSize: 10, packUnit: "kpl" });
  });

  it("returns null without a size, and ignores units glued to words", () => {
    expect(packFromName("Tilli")).toBeNull();
    expect(packFromName("Makkara 3 lajia")).toBeNull();
  });
});

const page = (ld: unknown, extra = "") =>
  `<html><head><title>Ignored</title>${extra}<script type="application/ld+json">${JSON.stringify(ld)}</script></head><body></body></html>`;

describe("S-kaupat helper: product page", () => {
  it("reads schema.org Product JSON-LD", () => {
    const html = page({
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Esimerkki kuohukerma 2 dl",
      gtin13: "6400000000019",
      sku: "6400000000019",
      brand: { "@type": "Brand", name: "Esimerkki" },
      offers: { "@type": "Offer", price: "1.29", priceCurrency: "EUR" },
    });
    expect(parseProductPage(html, "https://example.test/tuote/x/6400000000019")).toEqual({
      externalId: "6400000000019",
      ean: "6400000000019",
      name: "Esimerkki kuohukerma 2 dl",
      brand: "Esimerkki",
      packSize: 2,
      packUnit: "dl",
      price: 1.29,
      unitPrice: null,
      unitPriceUnit: null,
    });
  });

  it("finds the Product inside @graph and arrays", () => {
    const html = page({ "@graph": [{ "@type": "BreadcrumbList" }, { "@type": ["Product"], name: "Peruna 1 kg", gtin: "6400000000026", offers: [{ price: 0.99 }] }] });
    expect(parseProductPage(html, "")).toMatchObject({ ean: "6400000000026", externalId: "6400000000026", price: 0.99, packSize: 1, packUnit: "kg" });
  });

  it("falls back to og:title and an EAN in the URL", () => {
    const html = `<html><head><meta property="og:title" content="Tilli &amp; persilja"></head></html>`;
    expect(parseProductPage(html, "https://example.test/tuote/tilli/6400000000033")).toMatchObject({
      name: "Tilli & persilja",
      ean: "6400000000033",
      price: null,
    });
  });

  it("picks the page's own product over related-product blocks", () => {
    const related = { "@type": "Product", name: "Suositeltu tuote", gtin13: "6400000000026" };
    const own = { "@type": "Product", name: "Oikea kerma 2 dl", url: "https://example.test/tuote/oikea-kerma/6400000000019", gtin13: "6400000000019", offers: [{}, { price: "1,99" }] };
    const html = `${page(related)}${page(own)}`;
    expect(parseProductPage(html, "https://example.test/tuote/oikea-kerma/6400000000019/")).toMatchObject({ name: "Oikea kerma 2 dl", ean: "6400000000019", price: 1.99 });
    // Without a matching url, the node with an offer and a GTIN wins over a bare one.
    expect(parseProductPage(`${page(related)}${page({ ...own, url: undefined })}`, "")).toMatchObject({ ean: "6400000000019" });
  });

  it("ignores digit runs that aren't valid GTINs", () => {
    expect(validGtin("6400000000019")).toBe(true);
    expect(validGtin("6400000000011")).toBe(false);
    expect(validGtin("96385074")).toBe(true);
    const html = page({ "@type": "Product", name: "Tuote", gtin13: "6400000000011", sku: "SKU-1" });
    expect(parseProductPage(html, "https://example.test/tuote/1234567890123")).toMatchObject({ ean: null, externalId: "SKU-1" });
  });

  it("returns null for a page that doesn't identify a product", () => {
    expect(parseProductPage("<html><head><title>Haku: kerma</title></head></html>", "https://example.test/tuotteet?queryString=kerma")).toBeNull();
    expect(parseProductPage("<html></html>", "")).toBeNull();
  });
});
