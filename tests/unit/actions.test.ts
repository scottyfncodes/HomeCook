import { describe, expect, it } from 'vitest';
import {
  addPantryItem,
  completeOnboarding,
  fillEmptyDays,
  removePantryItem,
  resetEverything,
  setHousehold,
  setSettings,
  startNewWeek,
  stockStaples,
  toggleDislikedProtein,
  toggleExcludedIngredient,
  toggleLikedProtein,
  toggleLock,
  togglePantryItem,
} from '@homecook/core/actions';
import { STAPLE_IDS } from '@homecook/data/ingredients';
import { buildGroceryList } from '@homecook/engine/grocery';
import { householdSize } from '@homecook/engine/plan';
import { makeData, withMeals } from './helpers';

describe('household and settings', () => {
  it('rounds and floors household numbers', () => {
    const data = setHousehold(makeData(), { adults: 2.6, children: -3 });
    expect(data.household.adults).toBe(3);
    expect(data.household.children).toBe(0);
  });

  it('resizes the week when the number of dinners changes', () => {
    const data = setSettings(withMeals(makeData(), ['parmesan_garlic_chicken', 'korean_beef_bowls']), {
      mealsPerWeek: 4,
    });
    expect(data.plan.meals).toHaveLength(4);
    expect(data.plan.meals[0]!.recipeId).toBe('parmesan_garlic_chicken');
    expect(data.plan.meals[3]!.recipeId).toBeNull();
    expect(data.plan.meals[3]!.day).toBe('Thursday');
  });

  it('keeps meals when shrinking the week', () => {
    const five = withMeals(makeData(), [
      'parmesan_garlic_chicken',
      'korean_beef_bowls',
      'baked_ziti',
      'shrimp_scampi',
      'turkey_chili',
    ]);
    const three = setSettings(five, { mealsPerWeek: 3 });
    expect(three.plan.meals.map((m) => m.recipeId)).toEqual([
      'parmesan_garlic_chicken',
      'korean_beef_bowls',
      'baked_ziti',
    ]);
  });
});

describe('locks', () => {
  it('toggles on and off', () => {
    const data = withMeals(makeData(), ['parmesan_garlic_chicken']);
    const locked = toggleLock(data, data.plan.meals[0]!.id);
    expect(locked.plan.meals[0]!.locked).toBe(true);
    expect(toggleLock(locked, data.plan.meals[0]!.id).plan.meals[0]!.locked).toBe(false);
  });
});

describe('pantry', () => {
  it('adds, updates and removes', () => {
    let data = addPantryItem(makeData(), 'rice');
    expect(data.pantry).toEqual([{ ingredientId: 'rice' }]);

    data = addPantryItem(data, 'rice', 4, 'cup');
    expect(data.pantry).toEqual([{ ingredientId: 'rice', qty: 4, unit: 'cup' }]);

    data = removePantryItem(data, 'rice');
    expect(data.pantry).toEqual([]);
  });

  it('ignores things that are not ingredients', () => {
    expect(addPantryItem(makeData(), 'moon_dust').pantry).toEqual([]);
  });

  it('toggles an item in and out', () => {
    const on = togglePantryItem(makeData(), 'olive_oil');
    expect(on.pantry).toHaveLength(1);
    expect(togglePantryItem(on, 'olive_oil').pantry).toHaveLength(0);
  });

  it('stocks the staples without duplicating what is there', () => {
    const once = stockStaples(addPantryItem(makeData(), 'salt'));
    expect(once.pantry).toHaveLength(STAPLE_IDS.length);
    expect(stockStaples(once).pantry).toHaveLength(STAPLE_IDS.length);
  });

  it('makes the week cheaper', () => {
    const planned = withMeals(makeData(), ['parmesan_garlic_chicken', 'southwest_beef_bowls']);
    expect(buildGroceryList(stockStaples(planned)).total).toBeLessThan(buildGroceryList(planned).total);
  });
});

describe('preferences', () => {
  it('treats liking and never-planning as mutually exclusive', () => {
    let data = toggleLikedProtein(makeData(), 'pork');
    expect(data.preferences.likedProteins).toEqual(['pork']);

    data = toggleDislikedProtein(data, 'pork');
    expect(data.preferences.likedProteins).toEqual([]);
    expect(data.preferences.dislikedProteins).toEqual(['pork']);

    data = toggleLikedProtein(data, 'pork');
    expect(data.preferences.dislikedProteins).toEqual([]);
  });

  it('toggles ingredient exclusions', () => {
    const excluded = toggleExcludedIngredient(makeData(), 'mushroom');
    expect(excluded.preferences.excludedIngredients).toEqual(['mushroom']);
    expect(toggleExcludedIngredient(excluded, 'mushroom').preferences.excludedIngredients).toEqual([]);
  });
});

describe('week lifecycle', () => {
  it('fills only the empty days when asked to', () => {
    const data = withMeals(makeData(), ['parmesan_garlic_chicken', null, null]);
    const filled = fillEmptyDays(data, 3);
    expect(filled.plan.meals[0]!.recipeId).toBe('parmesan_garlic_chicken');
    expect(filled.plan.meals.every((meal) => meal.recipeId)).toBe(true);
  });

  it('starts a fresh week with a clean grocery list', () => {
    const data = {
      ...withMeals(makeData(), ['parmesan_garlic_chicken', 'korean_beef_bowls', 'baked_ziti']),
      grocery: { checked: ['garlic'], removed: ['salt'], custom: [{ id: 'c1', name: 'Foil', category: 'other' as const }] },
    };
    const next = startNewWeek(data);
    expect(next.grocery).toEqual({ checked: [], removed: [], custom: [] });
    expect(next.plan.meals.every((meal) => meal.recipeId)).toBe(true);
  });

  it('sets the household up and plans a first week in one go', () => {
    const data = completeOnboarding(makeData(), {
      adults: 2,
      children: 2,
      budget: 200,
      mealsPerWeek: 4,
      storeId: 'budget',
      stockStaples: true,
    });

    expect(data.onboarded).toBe(true);
    expect(householdSize(data.household)).toBe(4);
    expect(data.settings.budget).toBe(200);
    expect(data.settings.storeId).toBe('budget');
    expect(data.plan.meals).toHaveLength(4);
    expect(data.plan.meals.every((meal) => meal.recipeId)).toBe(true);
    expect(data.pantry.length).toBe(STAPLE_IDS.length);
  });

  it('resets back to a clean install', () => {
    const data = resetEverything();
    expect(data.onboarded).toBe(false);
    expect(data.ratings).toEqual({});
    expect(data.history).toEqual([]);
    expect(data.pantry).toEqual([]);
  });
});
