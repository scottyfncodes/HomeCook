/**
 * Recipe scaling.
 *
 * The number that matters is *servings cooked*, which comes from who is eating
 * that night (the household, or a per-meal override), the leftovers
 * preference, and any servings deliberately cooked for later. Ingredients are
 * then scaled by servings / recipe.servings — never by editing the label.
 */
import type { LeftoverPreference, LeftoverPotential, Recipe, RecipeIngredient } from '@homecook/core/types';

/** Extra servings, as a fraction of the diners, by preference and recipe. */
const LEFTOVER_BONUS: Record<LeftoverPreference, Record<LeftoverPotential, number>> = {
  none: { low: 0, medium: 0, high: 0 },
  sometimes: { low: 0, medium: 0.25, high: 0.5 },
  frequently: { low: 0.25, medium: 0.5, high: 1 },
};

export interface ServingPlan {
  /** People actually eating this meal. */
  diners: number;
  /** Servings cooked. */
  servings: number;
  /** Servings left over after everyone has eaten. */
  leftovers: number;
  /** Multiplier applied to the recipe's written quantities. */
  factor: number;
}

export function planServings(
  recipe: Recipe,
  diners: number,
  preference: LeftoverPreference,
  extraServings = 0,
): ServingPlan {
  const eaters = Math.max(1, Math.round(diners));
  const bonus = LEFTOVER_BONUS[preference][recipe.leftoverPotential];
  const servings = Math.max(1, Math.ceil(eaters * (1 + bonus)) + Math.max(0, Math.round(extraServings)));
  return {
    diners: eaters,
    servings,
    leftovers: servings - eaters,
    factor: servings / recipe.servings,
  };
}

function roundQty(qty: number): number {
  return Math.round(qty * 1000) / 1000;
}

/** Recipe quantities scaled to a number of servings. */
export function scaleIngredients(recipe: Recipe, servings: number): RecipeIngredient[] {
  const factor = servings / recipe.servings;
  return recipe.ingredients.map((item) => ({ ...item, qty: roundQty(item.qty * factor) }));
}

export function scaleRecipe(recipe: Recipe, servings: number): Recipe {
  return { ...recipe, ingredients: scaleIngredients(recipe, servings), servings };
}

/**
 * Cooking for twelve does not take three times as long as cooking for four —
 * prep grows, the pan time mostly does not.
 */
export function scaledTime(recipe: Recipe, servings: number): number {
  const factor = Math.max(1, servings / recipe.servings);
  const prep = Math.round(recipe.prepTime * (1 + (factor - 1) * 0.6));
  const cook = Math.round(recipe.cookTime * (1 + (factor - 1) * 0.25));
  return prep + cook;
}
