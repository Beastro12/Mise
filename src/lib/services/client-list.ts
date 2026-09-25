import "server-only";
import type { ClientList } from "../client-list";
import type { ListData } from "./lists";

export function toClientList(data: ListData, owner: boolean): ClientList {
  const products = new Map(data.products.map((p) => [p.id, p]));
  const offers = new Map(data.offers.map((o) => [o.id, o]));
  return {
    id: data.list.id,
    name: data.list.name,
    planId: data.list.planId,
    version: data.list.version,
    shareToken: owner ? data.list.shareToken : null,
    stores: data.stores.map((s) => ({ id: s.id, name: s.name })),
    sectionOrder: data.sectionOrder,
    items: data.items.map((i) => {
      const p = i.productId ? products.get(i.productId) : null;
      const o = i.offerId ? offers.get(i.offerId) : null;
      return {
        id: i.id,
        nameFi: i.nameFi,
        displayName: i.displayName,
        quantity: i.quantity,
        unit: i.unit,
        section: i.section,
        storeId: i.storeId,
        storeReason: i.storeReason,
        storeOverridden: i.storeOverridden,
        packs: i.packs,
        price: i.price,
        product: p ? { id: p.id, name: p.name, source: p.source, packSize: p.packSize, packUnit: p.packUnit } : null,
        offer: o ? { productName: o.productName, price: o.price, validTo: o.validTo } : null,
        sources: [...new Set(i.sources.map((s) => s.title))],
        state: i.state,
        household: !!i.householdItemId,
        note: i.note,
        manual: i.manual,
        checked: i.checked,
        movedToPantry: i.movedToPantry,
      };
    }),
  };
}
