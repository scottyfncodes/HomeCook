/**
 * Local persistence. Everything HomeCook knows lives in this one record, in
 * this device's localStorage — there is no account and no server.
 *
 * Two rules, borrowed from hard experience:
 *  1. A corrupt, truncated or foreign file must never break the app. Every
 *     load is sanitised field by field against defaults.
 *  2. The schema has to be able to grow, so loads run through migrations
 *     first and the export format carries its version.
 */
import type {
  Category,
  CookedMeal,
  CustomGroceryItem,
  Cuisine,
  DietaryTag,
  HomeCookData,
  Ingredient,
  LeftoverPreference,
  PantryItem,
  PlannedMeal,
  Preferences,
  Protein,
  Rating,
  Recipe,
  Unit,
  WeekPlan,
} from '@homecook/core/types';
import { CATEGORY_ORDER, RATINGS } from '@homecook/core/types';
import { DEFAULT_STORE_ID, STORES } from '@homecook/data/stores';
import { registerCustomIngredients } from '@homecook/data/ingredients';
import { slotDays } from '@homecook/engine/planner';

export const STORAGE_KEY = 'homecook.data.v1';
export const REJECTED_KEY = 'homecook.data.rejected';
export const DATA_VERSION = 1;

export const DEFAULT_BUDGET = 150;
export const DEFAULT_MEALS = 5;

export function freshPlan(mealCount = DEFAULT_MEALS): WeekPlan {
  return {
    weekOf: new Date().toISOString().slice(0, 10),
    seed: 1,
    meals: slotDays(mealCount).map((day, index) => ({
      id: `meal_${index}_${day.toLowerCase()}`,
      day,
      recipeId: null,
      locked: false,
      dinersOverride: null,
      extraServings: 0,
      cooked: false,
    })),
  };
}

export function freshData(now = Date.now()): HomeCookData {
  return {
    version: DATA_VERSION,
    createdAt: now,
    updatedAt: now,
    household: { adults: 2, children: 0, guests: 0 },
    settings: {
      budget: DEFAULT_BUDGET,
      mealsPerWeek: DEFAULT_MEALS,
      storeId: DEFAULT_STORE_ID,
      leftovers: 'sometimes',
      maxCookMinutes: 45,
    },
    preferences: {
      likedProteins: [],
      dislikedProteins: [],
      likedCuisines: [],
      dislikedCuisines: [],
      excludedIngredients: [],
      dietary: [],
    },
    plan: freshPlan(),
    pantry: [],
    ratings: {},
    history: [],
    imported: [],
    customIngredients: [],
    grocery: { checked: [], removed: [], custom: [] },
    onboarded: false,
  };
}

type Migration = (raw: Record<string, unknown>) => Record<string, unknown>;

/** Runs in order for any record older than DATA_VERSION. */
const MIGRATIONS: Record<number, Migration> = {
  // 1: (raw) => ({ ...raw, version: 2, ... }),
};

const UNITS: Unit[] = [
  'g', 'kg', 'oz', 'lb', 'ml', 'l', 'tsp', 'tbsp', 'cup', 'count', 'clove', 'bunch', 'can', 'slice',
];
const PROTEINS: Protein[] = ['chicken', 'beef', 'pork', 'sausage', 'seafood', 'turkey', 'vegetarian'];
const CUISINES: Cuisine[] = [
  'american', 'italian', 'mexican', 'mediterranean', 'asian', 'korean', 'indian', 'thai', 'french',
];
const DIETARY: DietaryTag[] = [
  'vegetarian', 'pescatarian', 'gluten-free', 'dairy-free', 'pork-free', 'nut-free',
];

function num(value: unknown, fallback: number, min = -Infinity, max = Infinity): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function str(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function strArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((v): v is string => typeof v === 'string' && v.length > 0))];
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function subset<T extends string>(value: unknown, allowed: readonly T[]): T[] {
  return strArray(value).filter((v): v is T => allowed.includes(v as T));
}

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function sanitisePlan(value: unknown, mealCount: number): WeekPlan {
  const raw = obj(value);
  const fallback = freshPlan(mealCount);
  const meals = Array.isArray(raw.meals) ? raw.meals : [];
  const cleaned: PlannedMeal[] = meals.map((entry, index) => {
    const m = obj(entry);
    const base = fallback.meals[index] ?? fallback.meals[0]!;
    const override = m.dinersOverride;
    return {
      id: str(m.id, base.id),
      day: str(m.day, base.day),
      recipeId: typeof m.recipeId === 'string' && m.recipeId ? m.recipeId : null,
      locked: bool(m.locked, false),
      dinersOverride: typeof override === 'number' && override > 0 ? Math.round(override) : null,
      extraServings: num(m.extraServings, 0, 0, 40),
      cooked: bool(m.cooked, false),
    };
  });
  return {
    weekOf: str(raw.weekOf, fallback.weekOf),
    seed: num(raw.seed, fallback.seed),
    meals: cleaned.length ? cleaned : fallback.meals,
  };
}

function sanitisePantry(value: unknown): PantryItem[] {
  if (!Array.isArray(value)) return [];
  const out: PantryItem[] = [];
  for (const entry of value) {
    const item = obj(entry);
    const id = str(item.ingredientId, '');
    if (!id || out.some((p) => p.ingredientId === id)) continue;
    const qty = item.qty;
    if (typeof qty === 'number' && Number.isFinite(qty) && qty > 0) {
      out.push({ ingredientId: id, qty, unit: oneOf(item.unit, UNITS, 'count') });
    } else {
      out.push({ ingredientId: id });
    }
  }
  return out;
}

function sanitiseRatings(value: unknown): Record<string, Rating> {
  const raw = obj(value);
  const out: Record<string, Rating> = {};
  for (const [id, rating] of Object.entries(raw)) {
    if (RATINGS.includes(rating as Rating)) out[id] = rating as Rating;
  }
  return out;
}

function sanitiseHistory(value: unknown): CookedMeal[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry): CookedMeal | null => {
      const item = obj(entry);
      const recipeId = str(item.recipeId, '');
      const date = str(item.date, '').slice(0, 10);
      if (!recipeId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
      const rating = RATINGS.includes(item.rating as Rating) ? (item.rating as Rating) : undefined;
      return { recipeId, date, diners: num(item.diners, 2, 1, 50), rating };
    })
    .filter((entry): entry is CookedMeal => entry !== null)
    .slice(-400);
}

function sanitiseIngredientRefs(value: unknown): Recipe['ingredients'] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry): Recipe['ingredients'][number] | null => {
      const item = obj(entry);
      const ingredientId = str(item.ingredientId, '');
      if (!ingredientId) return null;
      return {
        ingredientId,
        qty: num(item.qty, 1, 0, 1000),
        unit: oneOf(item.unit, UNITS, 'count'),
        optional: item.optional === true ? true : undefined,
        note: typeof item.note === 'string' ? item.note : undefined,
      };
    })
    .filter((entry): entry is Recipe['ingredients'][number] => entry !== null);
}

function sanitiseRecipes(value: unknown): Recipe[] {
  if (!Array.isArray(value)) return [];
  const out: Recipe[] = [];
  for (const entry of value) {
    const raw = obj(entry);
    const id = str(raw.id, '');
    const name = str(raw.name, '');
    if (!id || !name || out.some((r) => r.id === id)) continue;
    out.push({
      id,
      name,
      emoji: str(raw.emoji, '🍽️'),
      description: str(raw.description, ''),
      ingredients: sanitiseIngredientRefs(raw.ingredients),
      servings: num(raw.servings, 2, 1, 40),
      prepTime: num(raw.prepTime, 10, 0, 600),
      cookTime: num(raw.cookTime, 20, 0, 600),
      cuisine: oneOf(raw.cuisine, CUISINES, 'american'),
      protein: oneOf(raw.protein, PROTEINS, 'vegetarian'),
      cookingMethod: oneOf(
        raw.cookingMethod,
        ['skillet', 'oven', 'sheet-pan', 'one-pot', 'grill', 'slow', 'no-cook'] as const,
        'skillet',
      ),
      format: oneOf(
        raw.format,
        ['bowls', 'tacos', 'pasta', 'skillet', 'sheet-pan', 'soup', 'curry', 'sandwich', 'roast', 'salad', 'stir-fry', 'bake'] as const,
        'skillet',
      ),
      flavorTags: subset(raw.flavorTags, [
        'savory', 'spicy', 'creamy', 'cheesy', 'smoky', 'sweet-savory', 'citrus', 'garlic-forward', 'herb-forward', 'fresh', 'umami',
      ] as const),
      dietaryTags: subset(raw.dietaryTags, DIETARY),
      difficulty: oneOf(raw.difficulty, ['easy', 'medium', 'involved'] as const, 'easy'),
      leftoverPotential: oneOf(raw.leftoverPotential, ['low', 'medium', 'high'] as const, 'medium'),
      steps: strArray(raw.steps),
      source: oneOf(raw.source, ['library', 'imported', 'manual'] as const, 'imported'),
      planReady: raw.planReady === true,
      importedAt: typeof raw.importedAt === 'number' ? raw.importedAt : undefined,
    });
  }
  return out;
}

function sanitiseCustomIngredients(value: unknown): Ingredient[] {
  if (!Array.isArray(value)) return [];
  const out: Ingredient[] = [];
  for (const entry of value) {
    const raw = obj(entry);
    const id = str(raw.id, '');
    const name = str(raw.name, '');
    if (!id || !name || out.some((i) => i.id === id)) continue;
    const pkg = obj(raw.pkg);
    const unit = oneOf(raw.unit, UNITS, 'count');
    out.push({
      id,
      name,
      category: oneOf(raw.category, CATEGORY_ORDER as readonly Category[], 'other'),
      unit,
      pkg: {
        size: num(pkg.size, 1, 0.01, 10_000),
        unit: oneOf(pkg.unit, UNITS, unit),
        price: num(pkg.price, 0, 0, 1000),
        label: typeof pkg.label === 'string' ? pkg.label : 'as needed',
      },
      priced: raw.priced === true,
    });
  }
  return out;
}

function sanitiseCustomGrocery(value: unknown): CustomGroceryItem[] {
  if (!Array.isArray(value)) return [];
  const out: CustomGroceryItem[] = [];
  for (const entry of value) {
    const raw = obj(entry);
    const name = str(raw.name, '');
    if (!name) continue;
    out.push({
      id: str(raw.id, `custom_${out.length}_${name.toLowerCase().replace(/\W+/g, '_')}`),
      name,
      category: oneOf(raw.category, CATEGORY_ORDER as readonly Category[], 'other'),
      note: typeof raw.note === 'string' ? raw.note : undefined,
    });
  }
  return out;
}

function sanitisePreferences(value: unknown): Preferences {
  const raw = obj(value);
  return {
    likedProteins: subset(raw.likedProteins, PROTEINS),
    dislikedProteins: subset(raw.dislikedProteins, PROTEINS),
    likedCuisines: subset(raw.likedCuisines, CUISINES),
    dislikedCuisines: subset(raw.dislikedCuisines, CUISINES),
    excludedIngredients: strArray(raw.excludedIngredients),
    dietary: subset(raw.dietary, DIETARY),
  };
}

/** Field-by-field clean of anything claiming to be HomeCook data. */
export function sanitise(input: unknown): HomeCookData {
  let raw = obj(input);
  const defaults = freshData();

  let version = num(raw.version, DATA_VERSION, 0, 999);
  while (version < DATA_VERSION && MIGRATIONS[version]) {
    raw = MIGRATIONS[version]!(raw);
    version = num(raw.version, version + 1, 0, 999);
  }

  const household = obj(raw.household);
  const settings = obj(raw.settings);
  const grocery = obj(raw.grocery);
  const mealsPerWeek = Math.round(num(settings.mealsPerWeek, DEFAULT_MEALS, 1, 7));

  return {
    version: DATA_VERSION,
    createdAt: num(raw.createdAt, defaults.createdAt),
    updatedAt: num(raw.updatedAt, defaults.updatedAt),
    household: {
      adults: Math.round(num(household.adults, 2, 0, 30)),
      children: Math.round(num(household.children, 0, 0, 30)),
      guests: Math.round(num(household.guests, 0, 0, 30)),
    },
    settings: {
      budget: num(settings.budget, DEFAULT_BUDGET, 0, 100_000),
      mealsPerWeek,
      storeId: STORES.some((s) => s.id === settings.storeId)
        ? String(settings.storeId)
        : DEFAULT_STORE_ID,
      leftovers: oneOf(settings.leftovers, ['none', 'sometimes', 'frequently'] as LeftoverPreference[], 'sometimes'),
      maxCookMinutes: num(settings.maxCookMinutes, 45, 10, 600),
    },
    preferences: sanitisePreferences(raw.preferences),
    plan: sanitisePlan(raw.plan, mealsPerWeek),
    pantry: sanitisePantry(raw.pantry),
    ratings: sanitiseRatings(raw.ratings),
    history: sanitiseHistory(raw.history),
    imported: sanitiseRecipes(raw.imported),
    customIngredients: sanitiseCustomIngredients(raw.customIngredients),
    grocery: {
      checked: strArray(grocery.checked),
      removed: strArray(grocery.removed),
      custom: sanitiseCustomGrocery(grocery.custom),
    },
    onboarded: bool(raw.onboarded, false),
  };
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // Safari in private mode throws on access rather than returning null.
    return null;
  }
}

export function load(store: Storage | null = storage()): HomeCookData {
  if (!store) return freshData();
  const text = store.getItem(STORAGE_KEY);
  if (!text) return freshData();
  try {
    const data = sanitise(JSON.parse(text));
    registerCustomIngredients(data.customIngredients);
    return data;
  } catch {
    // Keep the unreadable copy around rather than silently deleting it.
    try {
      store.setItem(REJECTED_KEY, text);
    } catch {
      /* out of quota — nothing useful to do */
    }
    return freshData();
  }
}

export function save(data: HomeCookData, store: Storage | null = storage()): boolean {
  if (!store) return false;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify({ ...data, updatedAt: Date.now() }));
    return true;
  } catch {
    return false;
  }
}

export interface ExportEnvelope {
  app: 'HomeCook';
  version: number;
  exportedAt: string;
  data: HomeCookData;
}

export function exportData(data: HomeCookData): string {
  const envelope: ExportEnvelope = {
    app: 'HomeCook',
    version: DATA_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
  return JSON.stringify(envelope, null, 2);
}

export function exportFilename(now = new Date()): string {
  return `homecook-backup-${now.toISOString().slice(0, 10)}.json`;
}

export type ImportResult =
  | { ok: true; data: HomeCookData }
  | { ok: false; error: string };

/** Accepts either an export envelope or a bare data record. */
export function importData(text: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file isn't JSON HomeCook can read." };
  }
  const raw = obj(parsed);
  const body = 'data' in raw ? raw.data : raw;
  const candidate = obj(body);
  if (!('household' in candidate) && !('plan' in candidate) && !('settings' in candidate)) {
    return { ok: false, error: "That file doesn't look like a HomeCook backup." };
  }
  const data = sanitise(candidate);
  registerCustomIngredients(data.customIngredients);
  return { ok: true, data };
}
