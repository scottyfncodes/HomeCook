/**
 * Stores are a thin price layer on top of the catalogue: a name and a factor
 * applied to every baseline package price. It is crude, but it is honest about
 * being an estimate, and it is the seam where a real price source would plug in
 * later without the planner noticing.
 */
export interface Store {
  id: string;
  name: string;
  note: string;
  /** Multiplier on baseline package prices. */
  factor: number;
}

export const STORES: Store[] = [
  { id: 'budget', name: 'Budget grocer', note: 'Aldi-style, cheapest basket', factor: 0.82 },
  { id: 'supermarket', name: 'Big supermarket', note: 'Kroger / Safeway-style', factor: 1.0 },
  { id: 'warehouse', name: 'Warehouse club', note: 'Bulk packs, lower unit price', factor: 0.88 },
  { id: 'premium', name: 'Premium market', note: 'Whole Foods-style', factor: 1.28 },
];

export const DEFAULT_STORE_ID = 'supermarket';

export function getStore(id: string): Store {
  return STORES.find((s) => s.id === id) ?? STORES[1]!;
}
