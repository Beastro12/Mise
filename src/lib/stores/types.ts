import type { StoreId } from "@/db/schema";

/** A product as returned by a store adapter (before it is cached in `products`). */
export type StoreProduct = {
  storeId: StoreId;
  source: "s-kaupat" | "mock" | "manual" | "lidl-offer";
  externalId: string;
  ean: string | null;
  name: string;
  brand: string | null;
  packSize: number | null;
  packUnit: string | null;
  price: number | null;
  unitPrice: number | null;
  unitPriceUnit: string | null;
  storeExternalId: string | null;
  raw?: unknown;
};

export type StoreOffer = {
  storeId: StoreId;
  productName: string;
  nameFi: string;
  price: number;
  regularPrice: number | null;
  unitText: string | null;
  unitPrice: number | null;
  unitPriceUnit: string | null;
  validFrom: string;
  validTo: string;
};

/**
 * Common interface for store data. Implementations must be safe to fail:
 * callers catch errors and continue without prices.
 */
export interface StoreAdapter {
  readonly id: string; // e.g. "s-kaupat:mock"
  readonly storeId: StoreId;
  /** VERIFIED | UNVERIFIED | MOCK. Shown in the UI. */
  readonly status: "VERIFIED" | "UNVERIFIED" | "MOCK" | "OFF";
  readonly description: string;
  searchProducts(query: string): Promise<StoreProduct[]>;
  getProduct(externalId: string): Promise<StoreProduct | null>;
  getOffers(): Promise<StoreOffer[]>;
}
