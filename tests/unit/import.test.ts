import { describe, expect, it } from "vitest";
import { extractJsonLdRecipes, isoDurationToMinutes, pageText } from "@/lib/import/jsonld";
import { splitRecipesFromText } from "@/lib/import/text-heuristic";
import { parseOfferLines } from "@/lib/import/offers-text";

const page = (ld: unknown) => `<html><head><title>Test</title>
<script type="application/ld+json">${JSON.stringify(ld)}</script></head>
<body><article><h1>Recipe</h1><p>Some text</p></article></body></html>`;

describe("schema.org Recipe JSON-LD", () => {
  it("parses a plain Recipe object", () => {
    const [r] = extractJsonLdRecipes(
      page({
        "@context": "https://schema.org",
        "@type": "Recipe",
        name: "Kanakeitto &amp; nuudelit",
        recipeYield: ["4", "4 annosta"],
        prepTime: "PT15M",
        cookTime: "PT1H",
        recipeIngredient: ["400 g broilerin fileetä", "2 porkkanaa"],
        recipeInstructions: [
          { "@type": "HowToStep", text: "Pilko kana." },
          { "@type": "HowToStep", text: "Keitä." },
        ],
        keywords: "keitto, arki",
        recipeCategory: "Pääruoka",
        image: { "@type": "ImageObject", url: "/img/kana.jpg" },
      }),
      "https://example.fi/resepti/kanakeitto",
    );
    expect(r).toMatchObject({
      title: "Kanakeitto & nuudelit",
      servings: 4,
      prepMinutes: 15,
      cookMinutes: 60,
      ingredients: ["400 g broilerin fileetä", "2 porkkanaa"],
      steps: ["Pilko kana.", "Keitä."],
      imageUrl: "https://example.fi/img/kana.jpg",
    });
    expect(r.tags).toEqual(expect.arrayContaining(["keitto", "arki", "pääruoka"]));
  });

  it("finds recipes inside @graph and handles HowToSection and @type arrays", () => {
    const [r] = extractJsonLdRecipes(
      page({
        "@context": "https://schema.org",
        "@graph": [
          { "@type": "WebPage", name: "x" },
          {
            "@type": ["Recipe", "NewsArticle"],
            name: "Pulla",
            totalTime: "PT2H",
            recipeIngredient: ["5 dl maitoa"],
            recipeInstructions: [
              { "@type": "HowToSection", name: "Taikina", itemListElement: [{ "@type": "HowToStep", text: "Sekoita." }] },
              { "@type": "HowToSection", name: "Paisto", itemListElement: [{ "@type": "HowToStep", text: "Paista." }] },
            ],
          },
        ],
      }),
    );
    expect(r.title).toBe("Pulla");
    expect(r.steps).toEqual(["Sekoita.", "Paista."]);
    expect(r.prepMinutes).toBe(120);
  });

  it("returns [] when there is no Recipe", () => {
    expect(extractJsonLdRecipes(page({ "@type": "Article", name: "x" }))).toEqual([]);
    expect(extractJsonLdRecipes("<html><body>no json</body></html>")).toEqual([]);
  });

  it("parses ISO durations", () => {
    expect(isoDurationToMinutes("PT1H30M")).toBe(90);
    expect(isoDurationToMinutes("P0DT45M")).toBe(45);
    expect(isoDurationToMinutes("PT0S")).toBeNull();
    expect(isoDurationToMinutes("30")).toBe(30);
  });

  it("extracts readable page text for the Claude fallback", () => {
    const t = pageText("<html><head><title>T</title><script>var x</script></head><body><nav>menu</nav><article><h1>Soppa</h1><ul><li>1 l vettä</li></ul></article></body></html>");
    expect(t.title).toBe("T");
    expect(t.text).toBe("Soppa\n- 1 l vettä");
  });
});

describe("text recipe splitter (no-AI fallback)", () => {
  it("splits a markdown file with several recipes", () => {
    const md = `# Pinaattiletut
4 annosta

## Ainekset
- 5 dl maitoa
- 2 munaa
- 150 g pakastepinaattia

## Ohje
1. Sekoita ainekset.
2. Paista letut.

# Kaalilaatikko
Valmistusaika 90 min

Ainekset:
1 kg kaalia
400 g jauhelihaa

Valmistus:
Hauduta kaali. Sekoita ja paista uunissa.`;
    const rs = splitRecipesFromText(md);
    expect(rs.map((r) => r.title)).toEqual(["Pinaattiletut", "Kaalilaatikko"]);
    expect(rs[0]).toMatchObject({ servings: 4, ingredientLines: ["5 dl maitoa", "2 munaa", "150 g pakastepinaattia"], steps: ["Sekoita ainekset.", "Paista letut."] });
    expect(rs[1]).toMatchObject({ prepMinutes: 90, ingredientLines: ["1 kg kaalia", "400 g jauhelihaa"] });
  });

  it("splits plain text recipes by ingredient headers", () => {
    const txt = `Tomaattikeitto
Serves 2
Ingredients
1 can crushed tomatoes
2 dl cream
Method
Heat and blend.

Garlic bread
Ingredients:
1 baguette
50 g butter
Instructions:
Bake.`;
    const rs = splitRecipesFromText(txt);
    expect(rs.map((r) => r.title)).toEqual(["Tomaattikeitto", "Garlic bread"]);
    expect(rs[0].servings).toBe(2);
    expect(rs[1].ingredientLines).toEqual(["1 baguette", "50 g butter"]);
  });

  it("falls back to one recipe when there are no headers", () => {
    const rs = splitRecipesFromText("Munakas\n- 3 munaa\n- 1 dl maitoa\nVatkaa ja paista pannulla.");
    expect(rs).toHaveLength(1);
    expect(rs[0]).toMatchObject({ title: "Munakas", ingredientLines: ["3 munaa", "1 dl maitoa"], steps: ["Vatkaa ja paista pannulla."] });
  });
});

describe("pasted leaflet text parser", () => {
  it("parses product, price, size and unit price", () => {
    const offers = parseOfferLines(`Kermaviili 10 % 200 g 0,49 €
Tuore lohifilee 400 g — 5,99
Jauheliha 400 g 2.99€ (7,48 €/kg)
Tällä viikolla edullisesti!`);
    expect(offers).toEqual([
      { productName: "Kermaviili 10 % 200 g", price: 0.49, unitText: "200 g", unitPrice: null, unitPriceUnit: null },
      { productName: "Tuore lohifilee 400 g", price: 5.99, unitText: "400 g", unitPrice: null, unitPriceUnit: null },
      { productName: "Jauheliha 400 g", price: 2.99, unitText: "400 g", unitPrice: 7.48, unitPriceUnit: "kg" },
    ]);
  });
});
