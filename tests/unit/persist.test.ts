import { describe, expect, it } from 'vitest';
import {
  DATA_VERSION,
  STORAGE_KEY,
  exportData,
  exportFilename,
  freshData,
  importData,
  load,
  sanitise,
  save,
} from '@homecook/core/persist';
import { addPantryItem, rateRecipe, setHousehold, setMealDiners, stockStaples } from '@homecook/core/actions';
import { fakeStorage, makeData, withMeals } from './helpers';

describe('defaults', () => {
  it('starts as a two-adult household that has not been set up yet', () => {
    const data = freshData();
    expect(data.household).toEqual({ adults: 2, children: 0, guests: 0 });
    expect(data.settings.budget).toBe(150);
    expect(data.settings.mealsPerWeek).toBe(5);
    expect(data.plan.meals).toHaveLength(5);
    expect(data.plan.meals[0]!.day).toBe('Monday');
    expect(data.onboarded).toBe(false);
  });
});

describe('sanitising', () => {
  it('survives complete rubbish', () => {
    for (const input of [null, undefined, 42, 'nope', [], { household: 'two' }]) {
      const data = sanitise(input);
      expect(data.version).toBe(DATA_VERSION);
      expect(data.plan.meals.length).toBeGreaterThan(0);
      expect(Array.isArray(data.pantry)).toBe(true);
    }
  });

  it('clamps nonsense values instead of trusting them', () => {
    const data = sanitise({
      household: { adults: -4, children: 999, guests: 1.6 },
      settings: { budget: -20, mealsPerWeek: 99, storeId: 'imaginary', leftovers: 'always' },
    });
    expect(data.household.adults).toBe(0);
    expect(data.household.children).toBe(30);
    expect(data.household.guests).toBe(2);
    expect(data.settings.budget).toBe(0);
    expect(data.settings.mealsPerWeek).toBe(7);
    expect(data.settings.storeId).toBe('supermarket');
    expect(data.settings.leftovers).toBe('sometimes');
  });

  it('drops ratings and history it cannot make sense of', () => {
    const data = sanitise({
      ratings: { good_one: 'loved', bad_one: 'amazing' },
      history: [
        { recipeId: 'good_one', date: '2026-01-02', diners: 3 },
        { recipeId: 'no_date' },
        { date: '2026-01-02' },
      ],
    });
    expect(data.ratings).toEqual({ good_one: 'loved' });
    expect(data.history).toHaveLength(1);
    expect(data.history[0]!.diners).toBe(3);
  });

  it('keeps a pantry entry with no quantity as "always on hand"', () => {
    const data = sanitise({ pantry: [{ ingredientId: 'salt' }, { ingredientId: 'rice', qty: 2, unit: 'cup' }] });
    expect(data.pantry[0]).toEqual({ ingredientId: 'salt' });
    expect(data.pantry[1]).toEqual({ ingredientId: 'rice', qty: 2, unit: 'cup' });
  });

  it('de-duplicates pantry entries', () => {
    const data = sanitise({ pantry: [{ ingredientId: 'salt' }, { ingredientId: 'salt', qty: 5 }] });
    expect(data.pantry).toHaveLength(1);
  });
});

describe('saving and loading', () => {
  it('round-trips through storage', () => {
    const storage = fakeStorage();
    let data = stockStaples(setHousehold(makeData(), { adults: 3, children: 2 }));
    data = rateRecipe(data, 'korean_beef_bowls', 'loved');
    expect(save(data, storage)).toBe(true);

    const loaded = load(storage);
    expect(loaded.household.adults).toBe(3);
    expect(loaded.household.children).toBe(2);
    expect(loaded.pantry.length).toBe(data.pantry.length);
    expect(loaded.ratings.korean_beef_bowls).toBe('loved');
  });

  it('starts fresh when there is nothing stored', () => {
    expect(load(fakeStorage()).onboarded).toBe(false);
  });

  it('keeps an unreadable save instead of deleting it', () => {
    const storage = fakeStorage();
    storage.setItem(STORAGE_KEY, '{ this is not json');
    const data = load(storage);
    expect(data.onboarded).toBe(false);
    expect(storage.getItem('homecook.data.rejected')).toBe('{ this is not json');
  });

  it('copes with no storage at all', () => {
    expect(() => load(null)).not.toThrow();
    expect(save(freshData(), null)).toBe(false);
  });
});

describe('export and import', () => {
  it('round-trips the whole household', () => {
    let data = withMeals(makeData(), ['parmesan_garlic_chicken', 'korean_beef_bowls']);
    data = setMealDiners(data, data.plan.meals[1]!.id, 7);
    data = addPantryItem(data, 'rice', 3, 'cup');
    data = rateRecipe(data, 'korean_beef_bowls', 'loved');

    const result = importData(exportData(data));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.plan.meals.map((m) => m.recipeId)).toEqual([
      'parmesan_garlic_chicken',
      'korean_beef_bowls',
    ]);
    expect(result.data.plan.meals[1]!.dinersOverride).toBe(7);
    expect(result.data.pantry).toContainEqual({ ingredientId: 'rice', qty: 3, unit: 'cup' });
    expect(result.data.ratings.korean_beef_bowls).toBe('loved');
  });

  it('accepts a bare data record as well as an envelope', () => {
    const data = makeData();
    const result = importData(JSON.stringify(data));
    expect(result.ok).toBe(true);
  });

  it('refuses a file that is not HomeCook data', () => {
    expect(importData('{"totally":"unrelated"}')).toEqual({
      ok: false,
      error: "That file doesn't look like a HomeCook backup.",
    });
    expect(importData('not json at all').ok).toBe(false);
  });

  it('names the backup file by date', () => {
    expect(exportFilename(new Date('2026-04-18T10:00:00Z'))).toBe('homecook-backup-2026-04-18.json');
  });

  it('carries imported recipes and their ad-hoc ingredients across', () => {
    const data = {
      ...makeData(),
      imported: [
        {
          id: 'imported_test',
          name: 'Imported Test',
          emoji: '📒',
          description: '',
          ingredients: [{ ingredientId: 'x_harissa', qty: 2, unit: 'tbsp' as const }],
          servings: 2,
          prepTime: 5,
          cookTime: 10,
          cuisine: 'mediterranean' as const,
          protein: 'chicken' as const,
          cookingMethod: 'skillet' as const,
          format: 'skillet' as const,
          flavorTags: ['spicy' as const],
          dietaryTags: [],
          difficulty: 'easy' as const,
          leftoverPotential: 'medium' as const,
          steps: [],
          source: 'imported' as const,
          planReady: false,
        },
      ],
      customIngredients: [
        {
          id: 'x_harissa',
          name: 'Harissa',
          category: 'other' as const,
          unit: 'tbsp' as const,
          pkg: { size: 1, unit: 'tbsp' as const, price: 0, label: 'no price estimate' },
          priced: false,
        },
      ],
    };

    const result = importData(exportData(data));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.imported[0]!.name).toBe('Imported Test');
    expect(result.data.customIngredients[0]!.priced).toBe(false);
  });
});
