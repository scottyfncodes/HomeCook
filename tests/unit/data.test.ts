import { describe, expect, it } from 'vitest';
import { INGREDIENTS, getIngredient, matchIngredient } from '@homecook/data/ingredients';
import { RECIPES } from '@homecook/data/recipes';
import { STORES } from '@homecook/data/stores';
import { deriveDietary } from '@homecook/engine/dietary';
import { toCanonical } from '@homecook/engine/pricing';
import { estimateMealCost } from '@homecook/engine/pricing';

describe('ingredient catalogue', () => {
  it('has unique ids and sane packages', () => {
    const ids = INGREDIENTS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const ingredient of INGREDIENTS) {
      expect(ingredient.pkg.size, ingredient.id).toBeGreaterThan(0);
      expect(ingredient.pkg.price, ingredient.id).toBeGreaterThan(0);
      expect(toCanonical(ingredient, ingredient.pkg.size, ingredient.pkg.unit), ingredient.id).not.toBeNull();
    }
  });

  it('matches free text onto the catalogue', () => {
    expect(matchIngredient('boneless skinless chicken breasts')?.id).toBe('chicken_breast');
    expect(matchIngredient('Garlic')?.id).toBe('garlic');
    expect(matchIngredient('shredded mozzarella')?.id).toBe('mozzarella');
    expect(matchIngredient('blorpberries')).toBeUndefined();
  });
});

describe('recipe library', () => {
  it('has unique ids and complete records', () => {
    const ids = RECIPES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(RECIPES.length).toBeGreaterThanOrEqual(24);

    for (const recipe of RECIPES) {
      expect(recipe.servings, recipe.id).toBeGreaterThan(0);
      expect(recipe.ingredients.length, recipe.id).toBeGreaterThanOrEqual(4);
      expect(recipe.steps.length, recipe.id).toBeGreaterThan(0);
      expect(recipe.flavorTags.length, recipe.id).toBeGreaterThan(0);
      expect(recipe.prepTime + recipe.cookTime, recipe.id).toBeGreaterThan(0);
    }
  });

  it('only refers to ingredients that exist, in units that convert', () => {
    for (const recipe of RECIPES) {
      for (const item of recipe.ingredients) {
        const ingredient = getIngredient(item.ingredientId);
        expect(ingredient, `${recipe.id} → ${item.ingredientId}`).toBeTruthy();
        expect(item.qty, `${recipe.id} → ${item.ingredientId}`).toBeGreaterThan(0);
        expect(
          toCanonical(ingredient!, item.qty, item.unit),
          `${recipe.id} → ${item.ingredientId} (${item.unit} → ${ingredient!.unit})`,
        ).not.toBeNull();
      }
    }
  });

  it('can be priced, and nothing is absurd', () => {
    for (const recipe of RECIPES) {
      const perServing = estimateMealCost(recipe, 4) / 4;
      expect(perServing, recipe.id).toBeGreaterThan(0.5);
      expect(perServing, recipe.id).toBeLessThan(15);
    }
  });

  it('derives dietary tags that match the ingredients', () => {
    for (const recipe of RECIPES) {
      expect(recipe.dietaryTags, recipe.id).toEqual(deriveDietary(recipe.ingredients));
      if (recipe.protein === 'vegetarian') expect(recipe.dietaryTags, recipe.id).toContain('vegetarian');
      if (recipe.dietaryTags.includes('vegetarian')) {
        expect(recipe.ingredients.every((i) => getIngredient(i.ingredientId)!.category !== 'meat')).toBe(true);
      }
    }
  });

  it('covers a real spread of proteins, cuisines and methods', () => {
    const proteins = new Set(RECIPES.map((r) => r.protein));
    const cuisines = new Set(RECIPES.map((r) => r.cuisine));
    const methods = new Set(RECIPES.map((r) => r.cookingMethod));
    expect(proteins.size).toBeGreaterThanOrEqual(6);
    expect(cuisines.size).toBeGreaterThanOrEqual(7);
    expect(methods.size).toBeGreaterThanOrEqual(4);
    expect(RECIPES.filter((r) => r.protein === 'vegetarian').length).toBeGreaterThanOrEqual(4);
  });
});

describe('stores', () => {
  it('are a simple price factor around the baseline', () => {
    expect(STORES.some((s) => s.factor === 1)).toBe(true);
    for (const store of STORES) {
      expect(store.factor).toBeGreaterThan(0.5);
      expect(store.factor).toBeLessThan(2);
    }
  });
});
