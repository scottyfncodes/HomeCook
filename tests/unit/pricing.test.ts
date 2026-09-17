import { describe, expect, it } from 'vitest';
import { getIngredient } from '@homecook/data/ingredients';
import { getStore } from '@homecook/data/stores';
import { estimateMealCost, packagesFor, partialCost } from '@homecook/engine/pricing';
import { RECIPE_BY_ID } from '@homecook/data/recipes';

const chickenBreast = getIngredient('chicken_breast')!;

describe('package maths', () => {
  it('buys whole packages, not exact quantities', () => {
    // 2.5 lb needed from 1.5 lb packs is two packs, with product left over.
    const math = packagesFor(chickenBreast, 2.5);
    expect(math.packages).toBe(2);
    expect(math.purchasedQty).toBeCloseTo(3, 5);
    expect(math.surplus).toBeCloseTo(0.5, 5);
    expect(math.cost).toBeCloseTo(16.48, 2);
  });

  it('never buys a fraction of a package', () => {
    expect(packagesFor(chickenBreast, 0.2).packages).toBe(1);
  });

  it('tolerates a hair over a package rather than forcing another', () => {
    expect(packagesFor(chickenBreast, 1.53).packages).toBe(1);
    expect(packagesFor(chickenBreast, 1.8).packages).toBe(2);
  });

  it('buys nothing when nothing is needed', () => {
    expect(packagesFor(chickenBreast, 0).packages).toBe(0);
    expect(packagesFor(chickenBreast, 0).cost).toBe(0);
  });

  it('applies the store factor', () => {
    const budget = packagesFor(chickenBreast, 1.5, getStore('budget').factor);
    const premium = packagesFor(chickenBreast, 1.5, getStore('premium').factor);
    expect(budget.cost).toBeLessThan(premium.cost);
    expect(premium.cost).toBeCloseTo(chickenBreast.pkg.price * 1.28, 2);
  });

  it('prices a part-package for per-meal estimates', () => {
    expect(partialCost(chickenBreast, 0.75, 'lb')).toBeCloseTo(chickenBreast.pkg.price / 2, 2);
  });

  it('converts before pricing', () => {
    expect(partialCost(chickenBreast, 24, 'oz')).toBeCloseTo(chickenBreast.pkg.price, 1);
  });
});

describe('meal cost', () => {
  it('rises with servings', () => {
    const recipe = RECIPE_BY_ID.get('southwest_beef_bowls')!;
    const two = estimateMealCost(recipe, 2);
    const six = estimateMealCost(recipe, 6);
    expect(six).toBeGreaterThan(two * 2.5);
    expect(six).toBeCloseTo(two * 3, 1);
  });

  it('follows the store', () => {
    const recipe = RECIPE_BY_ID.get('southwest_beef_bowls')!;
    expect(estimateMealCost(recipe, 4, getStore('budget').factor)).toBeLessThan(
      estimateMealCost(recipe, 4, getStore('supermarket').factor),
    );
  });
});
