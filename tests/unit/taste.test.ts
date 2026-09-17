import { describe, expect, it } from 'vitest';
import { rateRecipe, toggleLikedCuisine, toggleLikedProtein } from '@homecook/core/actions';
import { RECIPE_BY_ID } from '@homecook/data/recipes';
import { buildTasteProfile, highlights, similarLikedCount, tasteScore } from '@homecook/engine/taste';
import { importFromText } from '@homecook/engine/importer';
import { applyImport } from '@homecook/core/actions';
import { makeData } from './helpers';

const korean = RECIPE_BY_ID.get('korean_beef_bowls')!;
const italian = RECIPE_BY_ID.get('baked_ziti')!;

describe('taste profile', () => {
  it('starts empty and says so', () => {
    const profile = buildTasteProfile(makeData());
    expect(profile.samples).toBe(0);
    expect(tasteScore(korean, profile)).toBe(0);
  });

  it('learns from what you rated well', () => {
    let data = rateRecipe(makeData(), 'korean_beef_bowls', 'loved');
    data = rateRecipe(data, 'beef_broccoli', 'good');
    const profile = buildTasteProfile(data);

    expect(profile.samples).toBe(2);
    expect(profile.proteins.beef).toBeGreaterThan(0.4);
    expect(tasteScore(korean, profile)).toBeGreaterThan(tasteScore(italian, profile));
  });

  it('learns from what you rejected', () => {
    const data = rateRecipe(makeData(), 'baked_ziti', 'never');
    const profile = buildTasteProfile(data);
    expect(profile.cuisines.italian).toBeLessThan(0);
    expect(tasteScore(italian, profile)).toBeLessThan(0);
  });

  it('takes explicit likes as strong signals', () => {
    let data = toggleLikedProtein(makeData(), 'seafood');
    data = toggleLikedCuisine(data, 'thai');
    const profile = buildTasteProfile(data);
    expect(profile.proteins.seafood).toBeGreaterThan(0.3);
    expect(tasteScore(RECIPE_BY_ID.get('coconut_curry_cod')!, profile)).toBeGreaterThan(0.2);
  });

  it('treats a kept recipe as a mild positive, weaker than a rating', () => {
    const imported = importFromText(
      ['Seoul Beef Bowls', 'Serves 2', 'Ingredients:', '1 lb ground beef', '2 tbsp gochujang', '1 cup rice'].join('\n'),
    );
    const withImport = applyImport(makeData(), imported);
    const importProfile = buildTasteProfile(withImport);
    const ratedProfile = buildTasteProfile(rateRecipe(makeData(), 'korean_beef_bowls', 'loved'));

    expect(importProfile.proteins.beef).toBeGreaterThan(0);
    expect(importProfile.proteins.beef!).toBeLessThan(ratedProfile.proteins.beef!);
  });

  it('does not let one dimension run away with the score', () => {
    let data = makeData();
    for (const id of ['korean_beef_bowls', 'beef_broccoli', 'smash_burgers', 'smoky_beef_tacos']) {
      data = rateRecipe(data, id, 'loved');
    }
    const profile = buildTasteProfile(data);
    expect(profile.proteins.beef).toBeLessThan(1);
    expect(tasteScore(korean, profile)).toBeLessThanOrEqual(1);
  });

  it('counts only genuinely similar liked meals', () => {
    let data = rateRecipe(makeData(), 'beef_broccoli', 'loved');
    data = rateRecipe(data, 'smoky_beef_tacos', 'good');
    data = rateRecipe(data, 'peanut_noodles', 'no');

    expect(similarLikedCount(korean, data)).toBe(2);
    expect(similarLikedCount(RECIPE_BY_ID.get('sheetpan_salmon')!, data)).toBe(0);
  });

  it('summarises likes and dislikes for the profile screen', () => {
    let data = rateRecipe(makeData(), 'korean_beef_bowls', 'loved');
    data = rateRecipe(data, 'baked_ziti', 'never');
    const { likes, dislikes } = highlights(buildTasteProfile(data), 'cuisines');

    expect(likes.map((l) => l.label)).toContain('korean');
    expect(dislikes.map((l) => l.label)).toContain('italian');
  });
});
