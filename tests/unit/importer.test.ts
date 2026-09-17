import { beforeEach, describe, expect, it } from 'vitest';
import { clearCustomIngredients, getIngredient } from '@homecook/data/ingredients';
import {
  importFromCsv,
  importFromJson,
  importFromText,
  importRecipes,
  parseIngredientLine,
} from '@homecook/engine/importer';
import { applyImport } from '@homecook/core/actions';
import { plannableRecipes } from '@homecook/engine/library';
import { makeData } from './helpers';

const CARD = `Garlic Herb Chicken with Lemon Orzo
Serves 2 | Prep 10 min | Cook 25 min

Ingredients:
1 lb chicken breasts
1 1/2 cup orzo
4 cloves garlic
1 lemon
2 tbsp olive oil
5 oz baby spinach

Instructions:
1. Sear the chicken.
2. Toast the orzo and simmer.
3. Finish with lemon and spinach.`;

beforeEach(() => {
  clearCustomIngredients();
});

describe('parsing an ingredient line', () => {
  it('reads quantity, unit and name', () => {
    expect(parseIngredientLine('2 tbsp olive oil')).toEqual({ qty: 2, unit: 'tbsp', name: 'olive oil' });
  });

  it('adds mixed fractions', () => {
    expect(parseIngredientLine('1 1/2 cup rice')?.qty).toBeCloseTo(1.5, 5);
    expect(parseIngredientLine('½ lb ground beef')?.qty).toBeCloseTo(0.5, 5);
  });

  it('drops parentheses and trailing notes', () => {
    expect(parseIngredientLine('- 3 cloves garlic (minced), smashed')).toEqual({
      qty: 3,
      unit: 'clove',
      name: 'garlic',
    });
  });

  it('assumes one of a thing with no quantity', () => {
    expect(parseIngredientLine('Lemon')).toEqual({ qty: 1, unit: 'count', name: 'Lemon' });
  });

  it('rejects a line with nothing in it', () => {
    expect(parseIngredientLine('   ')).toBeNull();
  });
});

describe('importing pasted recipe cards', () => {
  it('pulls out structure rather than storing the text', () => {
    const outcome = importFromText(CARD, 1_700_000_000_000);
    expect(outcome.recipes).toHaveLength(1);

    const recipe = outcome.recipes[0]!;
    expect(recipe.name).toBe('Garlic Herb Chicken with Lemon Orzo');
    expect(recipe.servings).toBe(2);
    expect(recipe.prepTime).toBe(10);
    expect(recipe.cookTime).toBe(25);
    expect(recipe.protein).toBe('chicken');
    expect(recipe.flavorTags).toContain('garlic-forward');
    expect(recipe.steps).toHaveLength(3);
    expect(recipe.source).toBe('imported');
    expect(recipe.planReady).toBe(true);
  });

  it('maps ingredient text onto the catalogue', () => {
    const recipe = importFromText(CARD, 1).recipes[0]!;
    const ids = recipe.ingredients.map((item) => item.ingredientId);
    expect(ids).toContain('chicken_breast');
    expect(ids).toContain('orzo');
    expect(ids).toContain('garlic');
    expect(recipe.ingredients.find((i) => i.ingredientId === 'garlic')!.qty).toBe(4);
  });

  it('derives dietary tags from what is actually in it', () => {
    const recipe = importFromText(CARD, 1).recipes[0]!;
    expect(recipe.dietaryTags).toContain('pork-free');
    expect(recipe.dietaryTags).not.toContain('vegetarian');
    expect(recipe.dietaryTags).not.toContain('gluten-free');
  });

  it('splits several cards in one paste', () => {
    const outcome = importFromText(`${CARD}\n\n---\n\nQuick Chickpea Curry\nServes 4\nIngredients:\n2 cans chickpeas\n1 can coconut milk\n2 tsp curry powder`, 1);
    expect(outcome.recipes.map((r) => r.name)).toEqual([
      'Garlic Herb Chicken with Lemon Orzo',
      'Quick Chickpea Curry',
    ]);
  });

  it('keeps an unknown ingredient honestly unpriced', () => {
    const outcome = importFromText(
      'Harissa Chicken\nServes 2\nIngredients:\n1 lb chicken breasts\n2 tbsp harissa paste\n1 cup couscous',
      1,
    );
    const custom = outcome.customIngredients.map((item) => item.id);
    expect(custom).toContain('x_harissa_paste');
    expect(outcome.customIngredients.every((item) => item.priced === false)).toBe(true);

    const data = applyImport(makeData(), outcome);
    expect(getIngredient('x_harissa_paste')?.name).toBe('Harissa Paste');
    expect(data.customIngredients).toHaveLength(2);
  });

  it('keeps a mostly unrecognised recipe as taste reference only', () => {
    const outcome = importFromText(
      'Mystery Bake\nServes 2\nIngredients:\n2 cups blorpberries\n1 tbsp squonk paste\n3 glorps of nonsense',
      1,
    );
    const recipe = outcome.recipes[0]!;
    expect(recipe.planReady).toBe(false);

    const data = applyImport(makeData(), outcome);
    expect(plannableRecipes(data).some((r) => r.id === recipe.id)).toBe(false);
    expect(data.imported).toHaveLength(1);
  });

  it('reports what it could not read instead of dropping it silently', () => {
    const outcome = importFromText('Just a title with no ingredients at all', 1);
    expect(outcome.recipes).toHaveLength(0);
    expect(outcome.skipped).toHaveLength(1);
  });
});

describe('importing files', () => {
  it('reads CSV with a header row', () => {
    const csv = [
      'name,servings,cuisine,ingredients',
      '"Korean Beef Bowls",2,Korean,"1 lb ground beef; 2 tbsp gochujang; 1 cup rice"',
      '"Shrimp Tacos",4,Mexican,"1 lb shrimp; 8 corn tortillas; 2 limes"',
    ].join('\n');
    const outcome = importFromCsv(csv, 1);

    expect(outcome.recipes).toHaveLength(2);
    expect(outcome.recipes[0]!.protein).toBe('beef');
    expect(outcome.recipes[0]!.cuisine).toBe('korean');
    expect(outcome.recipes[1]!.servings).toBe(4);
    expect(outcome.recipes[1]!.ingredients.map((i) => i.ingredientId)).toContain('shrimp');
  });

  it('reads JSON, as an array or under a recipes key', () => {
    const json = JSON.stringify({
      recipes: [
        {
          name: 'Sheet-Pan Salmon',
          servings: 2,
          ingredients: ['1 lb salmon fillets', '1 lb asparagus', '1 lemon'],
          steps: ['Roast it all at 425F'],
        },
      ],
    });
    const outcome = importFromJson(json, 1);
    expect(outcome.recipes).toHaveLength(1);
    expect(outcome.recipes[0]!.protein).toBe('seafood');
    expect(outcome.recipes[0]!.steps).toEqual(['Roast it all at 425F']);
  });

  it('picks the parser from the file name', () => {
    const csv = 'name,ingredients\n"Fast Pasta","12 oz spaghetti; 3 cloves garlic; 2 tbsp olive oil"';
    expect(importRecipes(csv, 'menus.csv', 1).recipes).toHaveLength(1);
    expect(importRecipes('[]', 'history.json', 1).recipes).toHaveLength(0);
    expect(importRecipes(CARD, 'paste.txt', 1).recipes).toHaveLength(1);
  });

  it('says so when the JSON is broken', () => {
    const outcome = importFromJson('{not json', 1);
    expect(outcome.recipes).toHaveLength(0);
    expect(outcome.skipped[0]).toMatch(/not valid JSON/i);
  });

  it('does not import the same recipe twice', () => {
    const outcome = importFromText(CARD, 1);
    const once = applyImport(makeData(), outcome);
    const twice = applyImport(once, importFromText(CARD, 2));
    expect(twice.imported).toHaveLength(1);
  });
});
