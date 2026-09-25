# Next session: S-kaupat cart automation

> **Update:** a first version now exists: `helper/` (Mac, Playwright, you log in, it fills the cart and picks the slot, then stops) plus the order feed `GET /api/share/<token>/order` with 2nd choices and delivery preferences. What's left is verifying it against the real site: steps 1–2 below, then fix the guesses in `helper/lib/site-skaupat.mjs`. Allow `www.s-kaupat.fi` in the session's network settings, or run the helper once with `--dry-run` and then for real, and report where it had to ask you.
>
> **Also new:** `npm run match` (D37) saves real S-kaupat products by reading the product page you open (schema.org JSON-LD, unverified for s-kaupat.fi). If it can't read a product page, record that page's structure (does it have `application/ld+json`? where are the EAN and price?) and adjust `helper/lib/product.mjs`. Step 3 below (re-mapping away from mock products) is what `npm run match` does.

This session built the planner and list. It did **not** touch S-kaupat carts, orders or login (out of scope). What follows is what the cart-automation session needs.

## The seam that exists

`GET /api/lists/<listId>/export` (the **Export S-market JSON** button on a list) returns:

```json
{
  "list_id": "…",
  "store": { "id": "smarket", "name": "S-market …", "externalId": "<S-kaupat store id or null>" },
  "generated_at": "2026-09-24T18:00:00.000Z",
  "items": [
    {
      "s_kaupat_product_id": "…",     // null for MOCK products
      "ean": "…",                     // null when unknown
      "name": "Product name",
      "quantity": 2,                  // packs to buy (1 when the pack size is unknown)
      "ingredient": "kerma",          // extra context
      "needed": "3 dl",
      "product_source": "s-kaupat | manual | mock"
    }
  ],
  "unmapped_ingredients": ["tilli", "…"]
}
```

Only S-market items that have a mapped product are in `items`. Everything else is listed in `unmapped_ingredients`. The mapping itself lives in `ingredient_product_map` (one row per `name_fi` × store → `products.id`). `products` keeps `external_id` (the S-kaupat id), `ean`, pack size, price and `fetched_at`.

## What the cart session has to do

1. **Verify S-kaupat's product API first.** It could not be inspected from this build environment: s-kaupat.fi was blocked by the egress policy (see DECISIONS.md D1). In a normal browser, open s-kaupat.fi, select the store, search a product, and record:
   - the request that returns search results (URL, method, headers, body), and how the selected store is passed;
   - the response fields for product id, EAN, name, brand, pack size, price, unit price;
   - any auth, cookie or bot protection involved.
2. Implement `src/lib/stores/skaupat-http.ts` against the existing `StoreAdapter` interface (`searchProducts`, `getProduct`, `getOffers`). Register it in `src/lib/stores/index.ts` as `S_KAUPAT_ADAPTER=http` and mark it VERIFIED in DECISIONS.md. The cache (`product_search_cache`, 24 h), the rate limiter (1.5 s spacing, 300 requests/day) and the mapping UI already sit on top of the interface.
3. Re-map: mock products (`source = "mock"`) have no real id. Clear them under More → Product matches and pick real products. Manually entered products keep whatever id you typed.
4. **Cart:** find out how S-kaupat adds to cart (logged-in session, cart API, or browser automation). Decide:
   - where the S-kaupat credentials or session live (never in this repo; probably a local-only runner rather than Vercel);
   - how to handle products that are out of stock or changed (fall back to the next candidate? ask?);
   - idempotency: re-sending the same list must not double the cart.
5. Keep personal-use volume and respect S-kaupat's terms. Stop and ask before automating anything that needs login if the terms forbid it.

## Useful code pointers

- `src/lib/services/lists.ts`: `exportSMarket`, `applyMappingToLists`
- `src/lib/services/products.ts`: search, cache, manual products, mapping
- `src/lib/stores/types.ts`: the adapter interface
- `src/db/schema.ts`: `products`, `ingredient_product_map`, `shopping_items.packs`
