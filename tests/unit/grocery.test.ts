import { describe, expect, it } from 'vitest';
import {
  addCustomGroceryItem,
  addPantryItem,
  dismissGroceryItem,
  setMealDiners,
  toggleChecked,
} from '@homecook/core/actions';
import { budgetStatus, buildGroceryList } from '@homecook/engine/grocery';
import { getIngredient } from '@homecook/data/ingredients';
import { RECIPE_BY_ID } from '@homecook/data/recipes';
import { makeData, withMeals } from './helpers';

function lineFor(data: Parameters<typeof buildGroceryList>[0], id: string) {
  return buildGroceryList(data)
    .sections.flatMap((section) => section.lines)
    .find((line) => line.key === id);
}

describe('consolidated grocery list', () => {
  it('adds up the same ingredient across meals and names the meals', () => {
    const data = withMeals(makeData(), ['parmesan_garlic_chicken', 'garlic_herb_chicken_pasta']);
    const garlic = lineFor(data, 'garlic')!;

    expect(garlic.meals.sort()).toEqual(['Garlic Herb Chicken Pasta', 'Parmesan Garlic Chicken']);
    expect(garlic.needQty).toBeGreaterThan(4);
    expect(garlic.packages).toBeGreaterThanOrEqual(1);
  });

  it('groups items under shop categories', () => {
    const list = buildGroceryList(withMeals(makeData(), ['parmesan_garlic_chicken']));
    const categories = list.sections.map((section) => section.category);
    expect(categories).toContain('meat');
    expect(categories).toContain('produce');
    expect(categories.indexOf('produce')).toBeLessThan(categories.indexOf('pantry'));
  });

  it('recalculates when a day gets extra guests', () => {
    const data = withMeals(makeData(), ['parmesan_garlic_chicken']);
    const before = buildGroceryList(data);
    const after = buildGroceryList(setMealDiners(data, data.plan.meals[0]!.id, 6));

    expect(after.total).toBeGreaterThan(before.total);
    expect(lineFor(setMealDiners(data, data.plan.meals[0]!.id, 6), 'chicken_breast')!.buyQty).toBeGreaterThan(
      lineFor(data, 'chicken_breast')!.buyQty,
    );
  });

  it('drops to nothing when no meals are planned', () => {
    const list = buildGroceryList(withMeals(makeData(), [null, null]));
    expect(list.itemCount).toBe(0);
    expect(list.total).toBe(0);
  });
});

describe('pantry subtraction', () => {
  it('leaves "always on hand" staples off the list entirely', () => {
    const planned = withMeals(makeData(), ['parmesan_garlic_chicken']);
    expect(lineFor(planned, 'salt')).toBeTruthy();

    const stocked = addPantryItem(planned, 'salt');
    expect(lineFor(stocked, 'salt')).toBeUndefined();
    expect(buildGroceryList(stocked).covered.some((line) => line.key === 'salt')).toBe(true);
  });

  it('subtracts a recorded quantity and buys only the shortfall', () => {
    const planned = withMeals(makeData(), ['southwest_beef_bowls']);
    const needed = lineFor(planned, 'rice')!.needQty;
    const stocked = addPantryItem(planned, 'rice', needed / 2, 'cup');
    const line = lineFor(stocked, 'rice')!;

    expect(line.fromPantry).toBeCloseTo(needed / 2, 2);
    expect(line.buyQty).toBeCloseTo(needed - line.fromPantry, 2);
    expect(line.buyQty).toBeLessThan(needed);
  });

  it('converts units when subtracting', () => {
    const planned = withMeals(makeData(), ['parmesan_garlic_chicken']);
    const needed = lineFor(planned, 'chicken_breast')!.needQty;
    const stocked = addPantryItem(planned, 'chicken_breast', 8, 'oz');
    expect(lineFor(stocked, 'chicken_breast')!.buyQty).toBeCloseTo(needed - 0.5, 2);
  });

  it('never buys negative amounts when the pantry has more than enough', () => {
    const planned = withMeals(makeData(), ['southwest_beef_bowls']);
    const stocked = addPantryItem(planned, 'rice', 40, 'cup');
    expect(lineFor(stocked, 'rice')).toBeUndefined();
    const covered = buildGroceryList(stocked).covered.find((line) => line.key === 'rice')!;
    expect(covered.buyQty).toBe(0);
    expect(covered.coveredBy).toBe('pantry');
  });
});

describe('list edits', () => {
  it('drops an item you say you already have, and can bring it back', () => {
    const planned = withMeals(makeData(), ['parmesan_garlic_chicken']);
    const dismissed = dismissGroceryItem(planned, 'parmesan');
    expect(lineFor(dismissed, 'parmesan')).toBeUndefined();
    expect(buildGroceryList(dismissed).covered.find((l) => l.key === 'parmesan')!.coveredBy).toBe('dismissed');
    expect(buildGroceryList(dismissed).total).toBeLessThan(buildGroceryList(planned).total);
  });

  it('keeps custom items on the list without inventing a price', () => {
    const data = addCustomGroceryItem(withMeals(makeData(), ['parmesan_garlic_chicken']), 'Bin bags', 'other');
    const line = buildGroceryList(data).sections.flatMap((s) => s.lines).find((l) => l.name === 'Bin bags')!;
    expect(line.kind).toBe('custom');
    expect(line.cost).toBe(0);
    expect(line.category).toBe('other');
  });

  it('tracks what has been ticked off', () => {
    const data = toggleChecked(withMeals(makeData(), ['parmesan_garlic_chicken']), 'chicken_breast');
    const list = buildGroceryList(data);
    expect(list.checkedCount).toBe(1);
    expect(list.sections.flatMap((s) => s.lines).find((l) => l.key === 'chicken_breast')!.checked).toBe(true);
    expect(buildGroceryList(toggleChecked(data, 'chicken_breast')).checkedCount).toBe(0);
  });
});

describe('budget', () => {
  it('reports what is left against the basket', () => {
    const status = budgetStatus(150, 120.5);
    expect(status.remaining).toBeCloseTo(29.5, 2);
    expect(status.over).toBe(false);
    expect(status.fraction).toBeCloseTo(0.803, 2);
  });

  it('flags going over', () => {
    const status = budgetStatus(100, 118.25);
    expect(status.over).toBe(true);
    expect(status.remaining).toBeCloseTo(-18.25, 2);
    expect(status.fraction).toBe(1);
  });

  it('prices the whole week from packages, not part-packs', () => {
    const data = withMeals(makeData(), ['parmesan_garlic_chicken', 'southwest_beef_bowls']);
    const list = buildGroceryList(data);
    const chicken = RECIPE_BY_ID.get('parmesan_garlic_chicken')!;
    expect(chicken).toBeTruthy();
    const summed = list.sections
      .flatMap((s) => s.lines)
      .reduce((total, line) => total + line.cost, 0);
    expect(list.total).toBeCloseTo(summed, 2);
    const beef = list.sections.flatMap((s) => s.lines).find((l) => l.key === 'ground_beef')!;
    expect(beef.cost).toBeCloseTo(beef.packages * getIngredient('ground_beef')!.pkg.price, 2);
  });
});
