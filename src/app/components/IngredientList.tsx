import type { Recipe } from '@homecook/core/types';
import { getIngredient } from '@homecook/data/ingredients';
import { scaleIngredients } from '@homecook/engine/scale';
import { formatAmount } from '@homecook/engine/units';

/** A recipe's ingredients, scaled to the servings actually being cooked. */
export function IngredientList({ recipe, servings }: { recipe: Recipe; servings: number }) {
  const scaled = scaleIngredients(recipe, servings);
  return (
    <ul className="ingredients">
      {scaled.map((item) => {
        const ingredient = getIngredient(item.ingredientId);
        return (
          <li key={item.ingredientId}>
            <span>
              {ingredient?.name ?? item.ingredientId}
              {item.optional ? <em> (optional)</em> : null}
              {ingredient && ingredient.priced === false ? <em> · no price estimate</em> : null}
            </span>
            <strong>{formatAmount(item.qty, item.unit)}</strong>
          </li>
        );
      })}
    </ul>
  );
}
