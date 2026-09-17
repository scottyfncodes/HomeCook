/**
 * Package-aware price estimation.
 *
 * Two different numbers matter and must not be confused:
 *  - *ingredient cost* of a meal: the share of each package the meal uses.
 *    Meals are compared with this.
 *  - *basket cost* of a week: whole packages, because the shop sells packages.
 *    The budget is spent against this.
 *
 * Both are estimates from a bundled price table, never a checkout total.
 */
import type { Ingredient, Recipe, Unit } from '@homecook/core/types';
import { getIngredient } from '@homecook/data/ingredients';
import { convert } from '@homecook/engine/units';
import { scaleIngredients } from '@homecook/engine/scale';

/** Buying 2.05 lb from 1 lb packs should be two packs, not three. */
const OVERSHOOT_TOLERANCE = 0.03;

export interface PackageMath {
  packages: number;
  /** What ends up in the basket, in the ingredient's canonical unit. */
  purchasedQty: number;
  cost: number;
  /** Leftover product after the week's cooking. */
  surplus: number;
}

/**
 * A quantity in the ingredient's own unit, crossing volume and mass through
 * the ingredient's cup weight when it has one — recipes write "1½ cups orzo"
 * as happily as "10 oz orzo".
 */
export function toCanonical(ingredient: Ingredient, qty: number, unit: Unit): number | null {
  const direct = convert(qty, unit, ingredient.unit);
  if (direct !== null) return direct;

  const grams = ingredient.gramsPerCup;
  if (!grams) return null;

  const cups = convert(qty, unit, 'cup');
  if (cups !== null) return convert(cups * grams, 'g', ingredient.unit);

  const asGrams = convert(qty, unit, 'g');
  if (asGrams !== null) return convert(asGrams / grams, 'cup', ingredient.unit);

  return null;
}

export function packagesFor(ingredient: Ingredient, qty: number, storeFactor = 1): PackageMath {
  const size = convert(ingredient.pkg.size, ingredient.pkg.unit, ingredient.unit) ?? ingredient.pkg.size;
  if (qty <= 0 || size <= 0) {
    return { packages: 0, purchasedQty: 0, cost: 0, surplus: 0 };
  }
  const packages = Math.max(1, Math.ceil(qty / size - OVERSHOOT_TOLERANCE));
  const purchasedQty = packages * size;
  const cost = round2(packages * ingredient.pkg.price * storeFactor);
  return { packages, purchasedQty, cost, surplus: round2(purchasedQty - qty) };
}

/** The share of a package this quantity represents, priced. */
export function partialCost(ingredient: Ingredient, qty: number, unit: Unit, storeFactor = 1): number {
  if (!ingredient.priced) return 0;
  const canonical = toCanonical(ingredient, qty, unit);
  if (canonical === null) return 0;
  const size = convert(ingredient.pkg.size, ingredient.pkg.unit, ingredient.unit) ?? ingredient.pkg.size;
  if (size <= 0) return 0;
  return round2((canonical / size) * ingredient.pkg.price * storeFactor);
}

/** Estimated ingredient cost of cooking this recipe for `servings` people. */
export function estimateMealCost(recipe: Recipe, servings: number, storeFactor = 1): number {
  let total = 0;
  for (const item of scaleIngredients(recipe, servings)) {
    const ingredient = getIngredient(item.ingredientId);
    if (!ingredient) continue;
    total += partialCost(ingredient, item.qty, item.unit, storeFactor);
  }
  return round2(total);
}

/** How many of a recipe's ingredients HomeCook cannot price. */
export function unpricedCount(recipe: Recipe): number {
  return recipe.ingredients.filter((item) => {
    const ingredient = getIngredient(item.ingredientId);
    return !ingredient || !ingredient.priced;
  }).length;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
