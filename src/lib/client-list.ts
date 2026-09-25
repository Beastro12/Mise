import type { StoreId } from "@/db/schema";

/** Plain-JSON list shape shared by server pages, API routes and the offline checklist. */
export type ClientItem = {
  id: string;
  nameFi: string;
  displayName: string;
  quantity: number | null;
  unit: string | null;
  section: string;
  storeId: StoreId;
  storeReason: string | null;
  storeOverridden: boolean;
  packs: number | null;
  price: number | null;
  product: { id: string; name: string; source: string; packSize: number | null; packUnit: string | null } | null;
  offer: { productName: string; price: number; validTo: string } | null;
  sources: string[];
  state: "none" | "ask" | "covered" | "have" | "refill" | "skipped";
  household: boolean;
  note: string | null;
  manual: boolean;
  checked: boolean;
  movedToPantry: boolean;
};

export type ClientList = {
  id: string;
  name: string;
  planId: string | null;
  version: number;
  shareToken: string | null; // only for the owner
  stores: Array<{ id: StoreId; name: string }>;
  sectionOrder: Record<StoreId, string[]>;
  items: ClientItem[];
};
