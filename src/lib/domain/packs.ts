import { convert } from "./units";

/**
 * How many packs to buy to cover the needed quantity.
 * Null when the quantity or pack size is unknown or the units are incompatible.
 */
export function packsNeeded(
  quantity: number | null,
  unit: string | null,
  packSize: number | null,
  packUnit: string | null,
): number | null {
  if (quantity == null || packSize == null || packSize <= 0 || !packUnit) return null;
  const need = convert(quantity, unit ?? "kpl", packUnit);
  if (need == null) return null;
  return Math.max(1, Math.ceil(need / packSize - 1e-9));
}
