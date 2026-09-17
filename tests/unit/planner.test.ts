import { describe, expect, it } from 'vitest';
import {
  markCooked,
  rateRecipe,
  regenerateWeek,
  setMealRecipe,
  setSettings,
  toggleDietary,
  toggleDislikedProtein,
  toggleExcludedIngredient,
  toggleLock,
} from '@homecook/core/actions';
import { RECIPE_BY_ID, RECIPES } from '@homecook/data/recipes';
import { exclusionFor } from '@homecook/engine/constraints';
import { buildGroceryList } from '@homecook/engine/grocery';
import { explainMeal, generateWeek, swapOptions } from '@homecook/engine/planner';
import { makeData, withMeals } from './helpers';

const TODAY = new Date('2026-03-04T12:00:00Z');

function plannedIds(data: ReturnType<typeof makeData>): string[] {
  return data.plan.meals.map((meal) => meal.recipeId).filter((id): id is string => Boolean(id));
}

describe('weekly plan generation', () => {
  it('fills every day with a different recipe', () => {
    const data = { ...makeData(), plan: generateWeek(makeData(), { seed: 7, today: TODAY }) };
    const ids = plannedIds(data);
    expect(ids).toHaveLength(5);
    expect(new Set(ids).size).toBe(5);
  });

  it('honours the number of dinners wanted', () => {
    const three = setSettings(makeData(), { mealsPerWeek: 3 });
    const plan = generateWeek(three, { seed: 3, today: TODAY });
    expect(plan.meals).toHaveLength(3);
    expect(plan.meals.every((meal) => meal.recipeId)).toBe(true);
  });

  it('is reproducible for a seed, and different across seeds', () => {
    const a = generateWeek(makeData(), { seed: 11, today: TODAY }).meals.map((m) => m.recipeId);
    const b = generateWeek(makeData(), { seed: 11, today: TODAY }).meals.map((m) => m.recipeId);
    const c = generateWeek(makeData(), { seed: 88, today: TODAY }).meals.map((m) => m.recipeId);
    expect(a).toEqual(b);
    expect(c).not.toEqual(a);
  });

  it('varies proteins across the week rather than repeating the cheapest', () => {
    const plan = generateWeek(makeData(), { seed: 5, today: TODAY });
    const proteins = plan.meals
      .map((meal) => RECIPE_BY_ID.get(meal.recipeId!)?.protein)
      .filter(Boolean);
    expect(new Set(proteins).size).toBeGreaterThanOrEqual(3);
  });

  it('keeps locked meals exactly where they are', () => {
    let data = withMeals(makeData(), ['parmesan_garlic_chicken', null, null, null, null]);
    data = toggleLock(data, data.plan.meals[0]!.id);
    const regenerated = regenerateWeek(data, 21);

    expect(regenerated.plan.meals[0]!.recipeId).toBe('parmesan_garlic_chicken');
    expect(regenerated.plan.meals[0]!.locked).toBe(true);
    expect(regenerated.plan.meals.slice(1).every((meal) => meal.recipeId)).toBe(true);
    expect(plannedIds(regenerated).filter((id) => id === 'parmesan_garlic_chicken')).toHaveLength(1);
  });

  it('keeps a day\'s headcount override through a regenerate', () => {
    let data = withMeals(makeData(), ['parmesan_garlic_chicken', null, null, null, null]);
    data = { ...data, plan: { ...data.plan, meals: data.plan.meals.map((m, i) => (i === 3 ? { ...m, dinersOverride: 6 } : m)) } };
    const regenerated = regenerateWeek(data, 4);
    expect(regenerated.plan.meals[3]!.dinersOverride).toBe(6);
  });

  it('tries to land inside the budget', () => {
    const tight = setSettings(makeData(), { budget: 70 });
    const generous = setSettings(makeData(), { budget: 400 });
    const tightTotal = buildGroceryList({ ...tight, plan: generateWeek(tight, { seed: 9, today: TODAY }) }).total;
    const generousTotal = buildGroceryList({
      ...generous,
      plan: generateWeek(generous, { seed: 9, today: TODAY }),
    }).total;

    expect(tightTotal).toBeLessThan(generousTotal);
  });
});

describe('hard exclusions', () => {
  it('never plans a recipe rated never again', () => {
    let data = rateRecipe(makeData(), 'parmesan_garlic_chicken', 'never');
    data = { ...data, plan: generateWeek(data, { seed: 2, today: TODAY }) };
    expect(plannedIds(data)).not.toContain('parmesan_garlic_chicken');
    expect(exclusionFor(RECIPE_BY_ID.get('parmesan_garlic_chicken')!, data)).toMatch(/never/i);
  });

  it('never plans an excluded ingredient', () => {
    let data = toggleExcludedIngredient(makeData(), 'mushroom');
    data = { ...data, plan: generateWeek(data, { seed: 6, today: TODAY }) };
    const usesMushrooms = plannedIds(data).some((id) =>
      RECIPE_BY_ID.get(id)!.ingredients.some((item) => item.ingredientId === 'mushroom'),
    );
    expect(usesMushrooms).toBe(false);
  });

  it('never plans a protein the household does not eat', () => {
    let data = toggleDislikedProtein(makeData(), 'pork');
    data = toggleDislikedProtein(data, 'seafood');
    data = { ...data, plan: generateWeek(data, { seed: 8, today: TODAY }) };
    const proteins = plannedIds(data).map((id) => RECIPE_BY_ID.get(id)!.protein);
    expect(proteins).not.toContain('pork');
    expect(proteins).not.toContain('seafood');
  });

  it('respects a dietary rule absolutely', () => {
    let data = toggleDietary(makeData(), 'vegetarian');
    data = { ...data, plan: generateWeek(data, { seed: 12, today: TODAY }) };
    const ids = plannedIds(data);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.every((id) => RECIPE_BY_ID.get(id)!.dietaryTags.includes('vegetarian'))).toBe(true);
  });

  it('keeps excluded recipes out of swap suggestions too', () => {
    let data = withMeals(makeData(), ['southwest_beef_bowls', 'parmesan_garlic_chicken']);
    data = toggleDislikedProtein(data, 'beef');
    const options = swapOptions(data, data.plan.meals[0]!.id);
    expect(options.length).toBeGreaterThan(0);
    expect(options.every((option) => option.recipe.protein !== 'beef')).toBe(true);
  });
});

describe('history and ratings', () => {
  it('pushes recently cooked meals down the list', () => {
    const base = withMeals(makeData(), ['southwest_beef_bowls']);
    const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);
    const cooked = {
      ...base,
      history: [{ recipeId: 'garlic_herb_chicken_pasta', date: twoDaysAgo, diners: 2 }],
    };
    const before = swapOptions(base, base.plan.meals[0]!.id, 40).find(
      (o) => o.recipe.id === 'garlic_herb_chicken_pasta',
    )!;
    const after = swapOptions(cooked, cooked.plan.meals[0]!.id, 40).find(
      (o) => o.recipe.id === 'garlic_herb_chicken_pasta',
    )!;
    expect(after.score).toBeLessThan(before.score);
    expect(after.cautions.join(' ')).toMatch(/cooked this/i);
  });

  it('lifts meals you loved and sinks ones you rejected', () => {
    const base = withMeals(makeData(), ['southwest_beef_bowls']);
    const target = 'sheetpan_lemon_chicken';
    const plain = swapOptions(base, base.plan.meals[0]!.id, 40).find((o) => o.recipe.id === target)!;
    const loved = swapOptions(rateRecipe(base, target, 'loved'), base.plan.meals[0]!.id, 40).find(
      (o) => o.recipe.id === target,
    )!;
    const rejected = swapOptions(rateRecipe(base, target, 'no'), base.plan.meals[0]!.id, 40).find(
      (o) => o.recipe.id === target,
    )!;

    expect(loved.score).toBeGreaterThan(plain.score);
    expect(rejected.score).toBeLessThan(plain.score);
    expect(loved.reasons.join(' ')).toMatch(/loved/i);
  });

  it('records a cooked meal with its headcount', () => {
    const data = markCooked(withMeals(makeData(), ['parmesan_garlic_chicken']), 'meal_0_monday', 'good');
    expect(data.history).toHaveLength(1);
    expect(data.history[0]!.recipeId).toBe('parmesan_garlic_chicken');
    expect(data.history[0]!.diners).toBe(2);
    expect(data.ratings.parmesan_garlic_chicken).toBe('good');
    expect(data.plan.meals[0]!.cooked).toBe(true);
  });
});

describe('swapping', () => {
  it('offers alternatives that are not already on the week', () => {
    const data = withMeals(makeData(), ['parmesan_garlic_chicken', 'southwest_beef_bowls']);
    const options = swapOptions(data, data.plan.meals[1]!.id, 6);
    expect(options.length).toBe(6);
    expect(options.map((o) => o.recipe.id)).not.toContain('parmesan_garlic_chicken');
    expect(options.map((o) => o.recipe.id)).not.toContain('southwest_beef_bowls');
  });

  it('reports the real change to the basket', () => {
    const data = withMeals(makeData(), ['parmesan_garlic_chicken', 'southwest_beef_bowls']);
    const before = buildGroceryList(data).total;
    const option = swapOptions(data, data.plan.meals[1]!.id, 5)[0]!;
    const after = buildGroceryList(setMealRecipe(data, data.plan.meals[1]!.id, option.recipe.id)).total;
    expect(option.costDelta).toBeCloseTo(after - before, 2);
  });

  it('rebuilds the grocery list after a swap', () => {
    const data = withMeals(makeData(), ['parmesan_garlic_chicken']);
    const swapped = setMealRecipe(data, data.plan.meals[0]!.id, 'peanut_noodles');
    const before = buildGroceryList(data).sections.flatMap((s) => s.lines).map((l) => l.key);
    const after = buildGroceryList(swapped).sections.flatMap((s) => s.lines).map((l) => l.key);
    expect(before).toContain('chicken_breast');
    expect(after).not.toContain('chicken_breast');
    expect(after).toContain('peanut_butter');
  });
});

describe('explaining a choice', () => {
  it('gives reasons and a score that adds up', () => {
    const data = withMeals(makeData(), ['parmesan_garlic_chicken', 'southwest_beef_bowls']);
    const candidate = explainMeal(data, data.plan.meals[0]!.id)!;

    expect(candidate.recipe.id).toBe('parmesan_garlic_chicken');
    expect(candidate.components.length).toBeGreaterThan(2);
    const sum = candidate.components.reduce((total, component) => total + component.points, 0);
    expect(candidate.score).toBeCloseTo(sum, 2);
    expect(candidate.reasons.length + candidate.cautions.length).toBeGreaterThan(0);
  });

  it('has nothing to explain for an empty day', () => {
    const data = withMeals(makeData(), [null]);
    expect(explainMeal(data, data.plan.meals[0]!.id)).toBeNull();
  });

  it('mentions the pantry when the pantry is doing work', () => {
    const data = {
      ...withMeals(makeData(), ['southwest_beef_bowls']),
      pantry: RECIPES.find((r) => r.id === 'southwest_beef_bowls')!.ingredients.map((i) => ({
        ingredientId: i.ingredientId,
      })),
    };
    const candidate = explainMeal(data, data.plan.meals[0]!.id)!;
    expect(candidate.reasons.join(' ')).toMatch(/pantry/i);
  });
});
