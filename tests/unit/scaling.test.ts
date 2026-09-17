import { describe, expect, it } from 'vitest';
import { RECIPE_BY_ID } from '@homecook/data/recipes';
import { planServings, scaleIngredients, scaledTime } from '@homecook/engine/scale';
import { dinersFor, householdSize, resolveMeal } from '@homecook/engine/plan';
import { setHousehold, setMealDiners, setExtraServings } from '@homecook/core/actions';
import { makeData, withMeals } from './helpers';

const chicken = RECIPE_BY_ID.get('parmesan_garlic_chicken')!;

describe('recipe scaling', () => {
  it('scales every ingredient, not just the label', () => {
    const forFour = scaleIngredients(chicken, 4);
    const forSix = scaleIngredients(chicken, 6);
    const base = chicken.ingredients.find((i) => i.ingredientId === 'chicken_breast')!;

    expect(chicken.servings).toBe(4);
    expect(forFour.find((i) => i.ingredientId === 'chicken_breast')!.qty).toBeCloseTo(base.qty, 5);
    expect(forSix.find((i) => i.ingredientId === 'chicken_breast')!.qty).toBeCloseTo(base.qty * 1.5, 5);
    for (const item of forSix) {
      const original = chicken.ingredients.find((i) => i.ingredientId === item.ingredientId)!;
      expect(item.qty).toBeCloseTo(original.qty * 1.5, 3);
    }
  });

  it('halves a two-serving week down to one diner', () => {
    const plan = planServings(chicken, 1, 'none');
    expect(plan.servings).toBe(1);
    expect(plan.factor).toBeCloseTo(0.25, 5);
    expect(scaleIngredients(chicken, plan.servings)[0]!.qty).toBeCloseTo(chicken.ingredients[0]!.qty * 0.25, 4);
  });

  it('does not grow cooking time linearly with servings', () => {
    const four = scaledTime(chicken, 4);
    const twelve = scaledTime(chicken, 12);
    expect(twelve).toBeGreaterThan(four);
    expect(twelve).toBeLessThan(four * 3);
  });
});

describe('leftovers preference', () => {
  it('cooks exactly the headcount when leftovers are off', () => {
    const plan = planServings(chicken, 5, 'none');
    expect(plan.servings).toBe(5);
    expect(plan.leftovers).toBe(0);
  });

  it('cooks extra for a high-leftover recipe when asked sometimes', () => {
    const chili = RECIPE_BY_ID.get('turkey_chili')!;
    expect(chili.leftoverPotential).toBe('high');
    const plan = planServings(chili, 2, 'sometimes');
    expect(plan.servings).toBe(3);
    expect(plan.leftovers).toBe(1);
  });

  it('doubles a high-leftover recipe when leftovers are frequent', () => {
    const chili = RECIPE_BY_ID.get('turkey_chili')!;
    const plan = planServings(chili, 4, 'frequently');
    expect(plan.servings).toBe(8);
    expect(plan.leftovers).toBe(4);
  });

  it('adds deliberately planned extra servings on top', () => {
    const plan = planServings(chicken, 2, 'none', 4);
    expect(plan.servings).toBe(6);
    expect(plan.leftovers).toBe(4);
  });
});

describe('household size and per-meal headcount', () => {
  it('counts adults, children and guests', () => {
    const data = setHousehold(makeData(), { adults: 2, children: 3, guests: 1 });
    expect(householdSize(data.household)).toBe(6);
  });

  it('never drops below one diner', () => {
    const data = setHousehold(makeData(), { adults: 0, children: 0, guests: 0 });
    expect(householdSize(data.household)).toBe(1);
  });

  it('overrides one night without touching the household', () => {
    let data = withMeals(makeData(), ['parmesan_garlic_chicken', 'southwest_beef_bowls']);
    const friday = data.plan.meals[1]!.id;
    data = setMealDiners(data, friday, 6);

    expect(householdSize(data.household)).toBe(2);
    expect(dinersFor(data.plan.meals[0]!, data.household)).toBe(2);
    expect(dinersFor(data.plan.meals[1]!, data.household)).toBe(6);

    const resolved = resolveMeal(data, data.plan.meals[1]!);
    expect(resolved.diners).toBe(6);
    expect(resolved.servings).toBeGreaterThanOrEqual(6);
    expect(resolved.cost).toBeGreaterThan(resolveMeal(data, data.plan.meals[0]!).cost);
  });

  it('returns a day to the household size when the override is cleared', () => {
    let data = withMeals(makeData(), ['parmesan_garlic_chicken']);
    const id = data.plan.meals[0]!.id;
    data = setMealDiners(data, id, 8);
    expect(resolveMeal(data, data.plan.meals[0]!).diners).toBe(8);
    data = setMealDiners(data, id, null);
    expect(resolveMeal(data, data.plan.meals[0]!).diners).toBe(2);
  });

  it('keeps planned extras per meal', () => {
    const plain = withMeals(makeData(), ['parmesan_garlic_chicken']);
    const before = resolveMeal(plain, plain.plan.meals[0]!);
    const data = setExtraServings(plain, plain.plan.meals[0]!.id, 2);
    const resolved = resolveMeal(data, data.plan.meals[0]!);
    expect(resolved.servings).toBe(before.servings + 2);
    expect(resolved.leftovers).toBe(before.leftovers + 2);
  });
});
