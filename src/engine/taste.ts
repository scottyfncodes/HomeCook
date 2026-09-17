/**
 * The taste profile.
 *
 * Everything here is arithmetic over things that actually happened: meals you
 * rated, meals you cooked, and recipes you kept (an imported HelloFresh menu
 * counts as a mild "we chose this once"). Explicit likes from the profile
 * screen are folded in as strong signals. Nothing is inferred from a single
 * weak hint, and every number can be traced back to a signal.
 */
import type { HomeCookData, Rating, Recipe } from '@homecook/core/types';
import { allRecipes } from '@homecook/engine/library';

/** How much each rating moves the profile. */
export const RATING_WEIGHT: Record<Rating, number> = {
  loved: 1,
  good: 0.6,
  fine: 0.1,
  no: -0.8,
  never: -1.2,
};

/** Keeping an old recipe is a weak positive; cooking one is a little stronger. */
const IMPORT_WEIGHT = 0.25;
const COOKED_WEIGHT = 0.15;
const EXPLICIT_WEIGHT = 1.2;

export interface TasteProfile {
  proteins: Record<string, number>;
  cuisines: Record<string, number>;
  flavors: Record<string, number>;
  methods: Record<string, number>;
  formats: Record<string, number>;
  /** How many signals went into this profile. */
  samples: number;
}

function emptyProfile(): TasteProfile {
  return { proteins: {}, cuisines: {}, flavors: {}, methods: {}, formats: {}, samples: 0 };
}

function add(map: Record<string, number>, key: string, weight: number): void {
  map[key] = (map[key] ?? 0) + weight;
}

/** Squash a raw signal sum into −1…1 so one loud dimension cannot dominate. */
function squash(sum: number): number {
  return sum / (Math.abs(sum) + 2);
}

function applyRecipe(profile: TasteProfile, recipe: Recipe, weight: number): void {
  add(profile.proteins, recipe.protein, weight);
  add(profile.cuisines, recipe.cuisine, weight);
  add(profile.methods, recipe.cookingMethod, weight);
  add(profile.formats, recipe.format, weight);
  for (const flavor of recipe.flavorTags) add(profile.flavors, flavor, weight / recipe.flavorTags.length);
  profile.samples += 1;
}

export function buildTasteProfile(data: HomeCookData): TasteProfile {
  const raw = emptyProfile();
  const pool = allRecipes(data);
  const byId = new Map(pool.map((r) => [r.id, r]));

  for (const [recipeId, rating] of Object.entries(data.ratings)) {
    const recipe = byId.get(recipeId);
    if (!recipe) continue;
    applyRecipe(raw, recipe, RATING_WEIGHT[rating]);
  }

  for (const entry of data.history) {
    // A rating already spoke for this meal; don't count it twice.
    if (data.ratings[entry.recipeId]) continue;
    const recipe = byId.get(entry.recipeId);
    if (recipe) applyRecipe(raw, recipe, COOKED_WEIGHT);
  }

  for (const recipe of data.imported) {
    if (data.ratings[recipe.id]) continue;
    applyRecipe(raw, recipe, IMPORT_WEIGHT);
  }

  for (const protein of data.preferences.likedProteins) add(raw.proteins, protein, EXPLICIT_WEIGHT);
  for (const protein of data.preferences.dislikedProteins) add(raw.proteins, protein, -EXPLICIT_WEIGHT);
  for (const cuisine of data.preferences.likedCuisines) add(raw.cuisines, cuisine, EXPLICIT_WEIGHT);
  for (const cuisine of data.preferences.dislikedCuisines) add(raw.cuisines, cuisine, -EXPLICIT_WEIGHT);

  const out = emptyProfile();
  out.samples = raw.samples;
  for (const dim of ['proteins', 'cuisines', 'flavors', 'methods', 'formats'] as const) {
    for (const [key, value] of Object.entries(raw[dim])) out[dim][key] = squash(value);
  }
  return out;
}

const DIMENSION_WEIGHT = { protein: 0.3, cuisine: 0.25, flavor: 0.25, method: 0.1, format: 0.1 };

/** How well a recipe matches the profile, −1 (wrong) … 1 (very much us). */
export function tasteScore(recipe: Recipe, profile: TasteProfile): number {
  const flavor = recipe.flavorTags.length
    ? recipe.flavorTags.reduce((sum, tag) => sum + (profile.flavors[tag] ?? 0), 0) / recipe.flavorTags.length
    : 0;
  return (
    (profile.proteins[recipe.protein] ?? 0) * DIMENSION_WEIGHT.protein +
    (profile.cuisines[recipe.cuisine] ?? 0) * DIMENSION_WEIGHT.cuisine +
    flavor * DIMENSION_WEIGHT.flavor +
    (profile.methods[recipe.cookingMethod] ?? 0) * DIMENSION_WEIGHT.method +
    (profile.formats[recipe.format] ?? 0) * DIMENSION_WEIGHT.format
  );
}

/**
 * Meals rated positively that share this one's protein, cuisine, or most of
 * its flavour profile. This is the claim behind "similar to N meals you liked",
 * so it is counted explicitly rather than inferred from the score.
 */
export function similarLikedCount(recipe: Recipe, data: HomeCookData): number {
  const pool = allRecipes(data);
  let count = 0;
  for (const other of pool) {
    if (other.id === recipe.id) continue;
    const rating = data.ratings[other.id];
    if (rating !== 'loved' && rating !== 'good') continue;
    const sharedFlavors = other.flavorTags.filter((t) => recipe.flavorTags.includes(t)).length;
    if (other.protein === recipe.protein || other.cuisine === recipe.cuisine || sharedFlavors >= 2) {
      count += 1;
    }
  }
  return count;
}

export interface TasteHighlight {
  label: string;
  value: number;
}

/** Strongest positive and negative signals, for the profile screen. */
export function highlights(profile: TasteProfile, dimension: keyof Omit<TasteProfile, 'samples'>): {
  likes: TasteHighlight[];
  dislikes: TasteHighlight[];
} {
  const entries = Object.entries(profile[dimension]).map(([label, value]) => ({ label, value }));
  return {
    likes: entries.filter((e) => e.value > 0.1).sort((a, b) => b.value - a.value).slice(0, 4),
    dislikes: entries.filter((e) => e.value < -0.1).sort((a, b) => a.value - b.value).slice(0, 4),
  };
}
