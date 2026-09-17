/**
 * Unit conversion and quantity formatting.
 *
 * Conversions only happen inside a family (mass, volume, count). Anything
 * across families — "how many grams is a cup of rice" — depends on the
 * ingredient, so the planner keeps those quantities apart rather than
 * inventing a number.
 */
import type { Unit } from '@homecook/core/types';

type Family = 'mass' | 'volume' | 'count';

/** Multiplier from the unit to its family's base (g, ml, or one item). */
const UNITS: Record<Unit, { family: Family; toBase: number }> = {
  g: { family: 'mass', toBase: 1 },
  kg: { family: 'mass', toBase: 1000 },
  oz: { family: 'mass', toBase: 28.3495 },
  lb: { family: 'mass', toBase: 453.592 },
  ml: { family: 'volume', toBase: 1 },
  l: { family: 'volume', toBase: 1000 },
  tsp: { family: 'volume', toBase: 4.929 },
  tbsp: { family: 'volume', toBase: 14.787 },
  cup: { family: 'volume', toBase: 236.588 },
  count: { family: 'count', toBase: 1 },
  clove: { family: 'count', toBase: 1 },
  bunch: { family: 'count', toBase: 1 },
  can: { family: 'count', toBase: 1 },
  slice: { family: 'count', toBase: 1 },
};

export function unitFamily(unit: Unit): Family {
  return UNITS[unit].family;
}

export function canConvert(from: Unit, to: Unit): boolean {
  if (from === to) return true;
  const a = UNITS[from];
  const b = UNITS[to];
  if (a.family !== b.family) return false;
  // Counted things are only interchangeable with themselves: 2 cloves are not
  // 2 cans. Everything else in the family converts freely.
  if (a.family === 'count') return false;
  return true;
}

export function convert(qty: number, from: Unit, to: Unit): number | null {
  if (from === to) return qty;
  if (!canConvert(from, to)) return null;
  return (qty * UNITS[from].toBase) / UNITS[to].toBase;
}

const FRACTIONS: [number, string][] = [
  [0, ''],
  [0.125, '⅛'],
  [0.25, '¼'],
  [0.333, '⅓'],
  [0.5, '½'],
  [0.667, '⅔'],
  [0.75, '¾'],
  [1, ''],
];

/** Kitchen-readable quantity: 1.5 → "1½", 0.26 → "¼", 340 → "340". */
export function formatQty(qty: number): string {
  if (!Number.isFinite(qty)) return '0';
  if (qty >= 10) return String(Math.round(qty));
  if (qty >= 1 && Number.isInteger(qty)) return String(qty);

  const whole = Math.floor(qty);
  const rest = qty - whole;
  let best = FRACTIONS[0]!;
  let bestGap = Infinity;
  for (const f of FRACTIONS) {
    const gap = Math.abs(rest - f[0]);
    if (gap < bestGap) {
      bestGap = gap;
      best = f;
    }
  }
  // Too far from a friendly fraction to pretend — show a decimal instead.
  if (bestGap > 0.04) return String(Math.round(qty * 100) / 100);

  const carried = best[0] === 1 ? whole + 1 : whole;
  const glyph = best[0] === 1 ? '' : best[1];
  if (!glyph) return String(carried);
  return carried > 0 ? `${carried}${glyph}` : glyph;
}

const COUNTED: Unit[] = ['count', 'clove', 'bunch', 'can', 'slice'];

/**
 * Counted things get snapped to quarters first: nobody buys 0.38 of a bunch of
 * cilantro, and "½ bunch" is what a person would write down.
 */
function snapCounted(qty: number): number {
  if (qty <= 0) return 0;
  return Math.max(0.25, Math.round(qty * 4) / 4);
}

export function formatAmount(qty: number, unit: Unit): string {
  if (!COUNTED.includes(unit)) return `${formatQty(qty)} ${unit}`;

  const snapped = snapCounted(qty);
  if (unit === 'count') return formatQty(snapped);
  const plural = snapped >= 2 ? `${unit}s` : unit;
  return `${formatQty(snapped)} ${plural}`;
}

export function formatMoney(value: number): string {
  return `$${value.toFixed(2)}`;
}

export function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
