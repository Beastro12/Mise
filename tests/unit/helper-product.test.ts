import { describe, expect, it } from "vitest";
import { packFromName, parseProductPage } from "../../helper/lib/product.mjs";

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
      gtin13: "6400000000001",
      sku: "6400000000001",
      brand: { "@type": "Brand", name: "Esimerkki" },
      offers: { "@type": "Offer", price: "1.29", priceCurrency: "EUR" },
    });
    expect(parseProductPage(html, "https://example.test/tuote/x/6400000000001")).toEqual({
      externalId: "6400000000001",
      ean: "6400000000001",
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
    const html = page({ "@graph": [{ "@type": "BreadcrumbList" }, { "@type": ["Product"], name: "Peruna 1 kg", gtin: "6400000000002", offers: [{ price: 0.99 }] }] });
    expect(parseProductPage(html, "")).toMatchObject({ ean: "6400000000002", externalId: "6400000000002", price: 0.99, packSize: 1, packUnit: "kg" });
  });

  it("falls back to og:title and an EAN in the URL", () => {
    const html = `<html><head><meta property="og:title" content="Tilli &amp; persilja"></head></html>`;
    expect(parseProductPage(html, "https://example.test/tuote/tilli/6400000000003")).toMatchObject({
      name: "Tilli & persilja",
      ean: "6400000000003",
      price: null,
    });
  });

  it("returns null for a page that doesn't identify a product", () => {
    expect(parseProductPage("<html><head><title>Haku: kerma</title></head></html>", "https://example.test/tuotteet?queryString=kerma")).toBeNull();
    expect(parseProductPage("<html></html>", "")).toBeNull();
  });
});
