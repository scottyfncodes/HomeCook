/** The recipe pool: the bundled library plus anything imported or entered. */
import type { HomeCookData, Recipe } from '@homecook/core/types';
import { RECIPES } from '@homecook/data/recipes';

export function allRecipes(data: HomeCookData): Recipe[] {
  return [...RECIPES, ...data.imported];
}

/** Recipes the planner may actually put on a day. */
export function plannableRecipes(data: HomeCookData): Recipe[] {
  return allRecipes(data).filter((r) => r.planReady !== false && r.ingredients.length > 0);
}

export function findRecipe(data: HomeCookData, id: string | null): Recipe | undefined {
  if (!id) return undefined;
  return allRecipes(data).find((r) => r.id === id);
}
