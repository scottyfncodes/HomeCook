/**
 * Hard constraints. These are not scores: a recipe that fails one is never
 * recommended, whatever else is in its favour.
 */
import type { HomeCookData, Recipe } from '@homecook/core/types';
import { getIngredient } from '@homecook/data/ingredients';

const DIETARY_LABEL: Record<string, string> = {
  vegetarian: 'vegetarian',
  pescatarian: 'pescatarian',
  'gluten-free': 'gluten-free',
  'dairy-free': 'dairy-free',
  'pork-free': 'pork-free',
  'nut-free': 'nut-free',
};

/** A human-readable reason this recipe is off the table, or null. */
export function exclusionFor(recipe: Recipe, data: HomeCookData): string | null {
  if (data.ratings[recipe.id] === 'never') return 'You marked this never again';

  if (data.preferences.dislikedProteins.includes(recipe.protein)) {
    return `You don't eat ${recipe.protein}`;
  }

  for (const id of data.preferences.excludedIngredients) {
    if (recipe.ingredients.some((item) => item.ingredientId === id)) {
      return `Contains ${getIngredient(id)?.name ?? id}`;
    }
  }

  for (const tag of data.preferences.dietary) {
    if (!recipe.dietaryTags.includes(tag)) return `Not ${DIETARY_LABEL[tag] ?? tag}`;
  }

  return null;
}

export function isExcluded(recipe: Recipe, data: HomeCookData): boolean {
  return exclusionFor(recipe, data) !== null;
}
