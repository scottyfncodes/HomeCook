/**
 * Dietary tags are derived from ingredients rather than hand-written on each
 * recipe. Hand tagging drifts the moment a recipe is edited, and an imported
 * recipe has no tags at all — deriving them means both kinds behave the same.
 */
import type { DietaryTag, RecipeIngredient } from '@homecook/core/types';
import { getIngredient } from '@homecook/data/ingredients';

const SEAFOOD = new Set(['shrimp', 'salmon', 'cod']);
const PORK = new Set(['bacon', 'ground_pork', 'pork_chop', 'pork_tenderloin', 'italian_sausage', 'chorizo']);
const GLUTEN = new Set([
  'penne',
  'spaghetti',
  'orzo',
  'panko',
  'flour',
  'soy_sauce',
  'flour_tortilla',
  'burger_bun',
  'ciabatta',
  'sandwich_bread',
  'naan',
]);
const NUTS = new Set(['peanut_butter']);
/** Dairy-free ignores eggs: they are shelved with dairy but are not dairy. */
const NOT_REALLY_DAIRY = new Set(['egg']);

export function deriveDietary(ingredients: RecipeIngredient[]): DietaryTag[] {
  const ids = ingredients.map((i) => i.ingredientId);
  const categories = ids.map((id) => getIngredient(id)?.category);

  const hasMeat = categories.some((c) => c === 'meat');
  const hasNonSeafoodMeat = ids.some((id) => getIngredient(id)?.category === 'meat' && !SEAFOOD.has(id));
  const hasDairy = ids.some(
    (id) => getIngredient(id)?.category === 'dairy' && !NOT_REALLY_DAIRY.has(id),
  );

  const tags: DietaryTag[] = [];
  if (!hasMeat) tags.push('vegetarian');
  if (!hasNonSeafoodMeat) tags.push('pescatarian');
  if (!ids.some((id) => GLUTEN.has(id))) tags.push('gluten-free');
  if (!hasDairy) tags.push('dairy-free');
  if (!ids.some((id) => PORK.has(id))) tags.push('pork-free');
  if (!ids.some((id) => NUTS.has(id))) tags.push('nut-free');
  return tags;
}
