/**
 * Every change the app can make to the household's data, as pure functions
 * from one record to the next. Keeping them here (rather than inside
 * components) is what makes the behaviour testable without a browser.
 */
import type {
  Category,
  Cuisine,
  DietaryTag,
  HomeCookData,
  LeftoverPreference,
  PantryItem,
  Protein,
  Rating,
  Recipe,
  Unit,
} from '@homecook/core/types';
import { freshData, freshPlan } from '@homecook/core/persist';
import { getIngredient, registerCustomIngredients, STAPLE_IDS } from '@homecook/data/ingredients';
import { ensureSlots, generateWeek, weekOf } from '@homecook/engine/planner';
import type { ImportOutcome } from '@homecook/engine/importer';

function touch(data: HomeCookData): HomeCookData {
  return { ...data, updatedAt: Date.now() };
}

function mapMeal(data: HomeCookData, mealId: string, fn: (meal: HomeCookData['plan']['meals'][number]) => HomeCookData['plan']['meals'][number]): HomeCookData {
  return touch({
    ...data,
    plan: { ...data.plan, meals: data.plan.meals.map((meal) => (meal.id === mealId ? fn(meal) : meal)) },
  });
}

// ---- Household and settings ----

export function setHousehold(data: HomeCookData, patch: Partial<HomeCookData['household']>): HomeCookData {
  const household = { ...data.household, ...patch };
  return touch({
    ...data,
    household: {
      adults: Math.max(0, Math.round(household.adults)),
      children: Math.max(0, Math.round(household.children)),
      guests: Math.max(0, Math.round(household.guests)),
    },
  });
}

export function setSettings(data: HomeCookData, patch: Partial<HomeCookData['settings']>): HomeCookData {
  const settings = { ...data.settings, ...patch };
  const next = touch({ ...data, settings });
  if (patch.mealsPerWeek && patch.mealsPerWeek !== data.settings.mealsPerWeek) {
    return { ...next, plan: { ...next.plan, meals: ensureSlots(next, settings.mealsPerWeek) } };
  }
  return next;
}

export function setLeftoverPreference(data: HomeCookData, preference: LeftoverPreference): HomeCookData {
  return setSettings(data, { leftovers: preference });
}

// ---- The week ----

export function regenerateWeek(data: HomeCookData, seed?: number): HomeCookData {
  const plan = generateWeek(data, { seed });
  return touch({
    ...data,
    plan,
    // Tick-offs belong to the week that generated them.
    grocery: { ...data.grocery, checked: [], removed: [] },
  });
}

export function fillEmptyDays(data: HomeCookData, seed?: number): HomeCookData {
  return touch({ ...data, plan: generateWeek(data, { seed, fillOnly: true }) });
}

export function startNewWeek(data: HomeCookData): HomeCookData {
  const cleared: HomeCookData = {
    ...data,
    plan: { ...freshPlan(data.settings.mealsPerWeek), weekOf: weekOf(new Date()) },
    grocery: { checked: [], removed: [], custom: [] },
  };
  return regenerateWeek(cleared);
}

export function toggleLock(data: HomeCookData, mealId: string): HomeCookData {
  return mapMeal(data, mealId, (meal) => ({ ...meal, locked: !meal.locked }));
}

export function setMealRecipe(data: HomeCookData, mealId: string, recipeId: string | null): HomeCookData {
  return mapMeal(data, mealId, (meal) => ({ ...meal, recipeId, cooked: false }));
}

/** Per-meal headcount. `null` returns the day to the household's size. */
export function setMealDiners(data: HomeCookData, mealId: string, diners: number | null): HomeCookData {
  return mapMeal(data, mealId, (meal) => ({
    ...meal,
    dinersOverride: diners === null ? null : Math.max(1, Math.round(diners)),
  }));
}

export function setExtraServings(data: HomeCookData, mealId: string, extra: number): HomeCookData {
  return mapMeal(data, mealId, (meal) => ({ ...meal, extraServings: Math.max(0, Math.round(extra)) }));
}

export function markCooked(data: HomeCookData, mealId: string, rating?: Rating): HomeCookData {
  const meal = data.plan.meals.find((m) => m.id === mealId);
  if (!meal?.recipeId) return data;
  const diners = meal.dinersOverride ?? data.household.adults + data.household.children + data.household.guests;
  const entry = { recipeId: meal.recipeId, date: new Date().toISOString().slice(0, 10), diners, rating };
  const withHistory = { ...data, history: [...data.history, entry] };
  const rated = rating ? { ...withHistory, ratings: { ...data.ratings, [meal.recipeId]: rating } } : withHistory;
  return mapMeal(rated, mealId, (m) => ({ ...m, cooked: true }));
}

export function rateRecipe(data: HomeCookData, recipeId: string, rating: Rating | null): HomeCookData {
  const ratings = { ...data.ratings };
  if (rating) ratings[recipeId] = rating;
  else delete ratings[recipeId];
  return touch({ ...data, ratings });
}

// ---- Pantry ----

export function addPantryItem(data: HomeCookData, ingredientId: string, qty?: number, unit?: Unit): HomeCookData {
  if (!getIngredient(ingredientId)) return data;
  const item: PantryItem = qty && qty > 0 ? { ingredientId, qty, unit: unit ?? getIngredient(ingredientId)!.unit } : { ingredientId };
  const pantry = [...data.pantry.filter((p) => p.ingredientId !== ingredientId), item];
  return touch({ ...data, pantry });
}

export function removePantryItem(data: HomeCookData, ingredientId: string): HomeCookData {
  return touch({ ...data, pantry: data.pantry.filter((p) => p.ingredientId !== ingredientId) });
}

export function togglePantryItem(data: HomeCookData, ingredientId: string): HomeCookData {
  return data.pantry.some((p) => p.ingredientId === ingredientId)
    ? removePantryItem(data, ingredientId)
    : addPantryItem(data, ingredientId);
}

export function stockStaples(data: HomeCookData): HomeCookData {
  const missing = STAPLE_IDS.filter((id) => !data.pantry.some((p) => p.ingredientId === id));
  return touch({ ...data, pantry: [...data.pantry, ...missing.map((id) => ({ ingredientId: id }))] });
}

// ---- Grocery list ----

export function toggleChecked(data: HomeCookData, key: string): HomeCookData {
  const checked = data.grocery.checked.includes(key)
    ? data.grocery.checked.filter((k) => k !== key)
    : [...data.grocery.checked, key];
  return touch({ ...data, grocery: { ...data.grocery, checked } });
}

export function dismissGroceryItem(data: HomeCookData, key: string): HomeCookData {
  if (data.grocery.removed.includes(key)) return data;
  return touch({ ...data, grocery: { ...data.grocery, removed: [...data.grocery.removed, key] } });
}

export function restoreGroceryItem(data: HomeCookData, key: string): HomeCookData {
  return touch({
    ...data,
    grocery: { ...data.grocery, removed: data.grocery.removed.filter((k) => k !== key) },
  });
}

export function addCustomGroceryItem(data: HomeCookData, name: string, category: Category = 'other'): HomeCookData {
  const trimmed = name.trim();
  if (!trimmed) return data;
  const id = `custom_${Date.now()}_${trimmed.toLowerCase().replace(/\W+/g, '_').slice(0, 24)}`;
  return touch({
    ...data,
    grocery: { ...data.grocery, custom: [...data.grocery.custom, { id, name: trimmed, category }] },
  });
}

export function removeCustomGroceryItem(data: HomeCookData, id: string): HomeCookData {
  return touch({
    ...data,
    grocery: {
      ...data.grocery,
      custom: data.grocery.custom.filter((c) => c.id !== id),
      checked: data.grocery.checked.filter((k) => k !== id),
    },
  });
}

export function clearCheckedItems(data: HomeCookData): HomeCookData {
  return touch({ ...data, grocery: { ...data.grocery, checked: [] } });
}

// ---- Preferences ----

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function toggleLikedProtein(data: HomeCookData, protein: Protein): HomeCookData {
  const likedProteins = toggle(data.preferences.likedProteins, protein);
  const dislikedProteins = data.preferences.dislikedProteins.filter((p) => p !== protein);
  return touch({ ...data, preferences: { ...data.preferences, likedProteins, dislikedProteins } });
}

/** A disliked protein is a hard exclusion, not a nudge. */
export function toggleDislikedProtein(data: HomeCookData, protein: Protein): HomeCookData {
  const dislikedProteins = toggle(data.preferences.dislikedProteins, protein);
  const likedProteins = data.preferences.likedProteins.filter((p) => p !== protein);
  return touch({ ...data, preferences: { ...data.preferences, likedProteins, dislikedProteins } });
}

export function toggleLikedCuisine(data: HomeCookData, cuisine: Cuisine): HomeCookData {
  const likedCuisines = toggle(data.preferences.likedCuisines, cuisine);
  const dislikedCuisines = data.preferences.dislikedCuisines.filter((c) => c !== cuisine);
  return touch({ ...data, preferences: { ...data.preferences, likedCuisines, dislikedCuisines } });
}

export function toggleDislikedCuisine(data: HomeCookData, cuisine: Cuisine): HomeCookData {
  const dislikedCuisines = toggle(data.preferences.dislikedCuisines, cuisine);
  const likedCuisines = data.preferences.likedCuisines.filter((c) => c !== cuisine);
  return touch({ ...data, preferences: { ...data.preferences, likedCuisines, dislikedCuisines } });
}

export function toggleDietary(data: HomeCookData, tag: DietaryTag): HomeCookData {
  return touch({
    ...data,
    preferences: { ...data.preferences, dietary: toggle(data.preferences.dietary, tag) },
  });
}

export function toggleExcludedIngredient(data: HomeCookData, ingredientId: string): HomeCookData {
  return touch({
    ...data,
    preferences: {
      ...data.preferences,
      excludedIngredients: toggle(data.preferences.excludedIngredients, ingredientId),
    },
  });
}

// ---- Imported recipes ----

export function applyImport(data: HomeCookData, outcome: ImportOutcome): HomeCookData {
  if (!outcome.recipes.length) return data;
  registerCustomIngredients(outcome.customIngredients);
  const existingNames = new Set(data.imported.map((r) => r.name.toLowerCase()));
  const fresh = outcome.recipes.filter((r) => !existingNames.has(r.name.toLowerCase()));
  const customIngredients = [...data.customIngredients];
  for (const item of outcome.customIngredients) {
    if (!customIngredients.some((c) => c.id === item.id)) customIngredients.push(item);
  }
  return touch({ ...data, imported: [...data.imported, ...fresh], customIngredients });
}

export function removeImportedRecipe(data: HomeCookData, recipeId: string): HomeCookData {
  const ratings = { ...data.ratings };
  delete ratings[recipeId];
  return touch({
    ...data,
    ratings,
    imported: data.imported.filter((r) => r.id !== recipeId),
    plan: {
      ...data.plan,
      meals: data.plan.meals.map((m) => (m.recipeId === recipeId ? { ...m, recipeId: null } : m)),
    },
  });
}

export function addManualRecipe(data: HomeCookData, recipe: Recipe): HomeCookData {
  return touch({ ...data, imported: [...data.imported, recipe] });
}

// ---- Whole-record ----

export function completeOnboarding(
  data: HomeCookData,
  config: {
    adults: number;
    children: number;
    budget: number;
    mealsPerWeek: number;
    storeId: string;
    stockStaples: boolean;
  },
): HomeCookData {
  let next = setHousehold(data, { adults: config.adults, children: config.children, guests: 0 });
  next = setSettings(next, {
    budget: config.budget,
    mealsPerWeek: config.mealsPerWeek,
    storeId: config.storeId,
  });
  if (config.stockStaples) next = stockStaples(next);
  next = { ...next, onboarded: true };
  return regenerateWeek(next);
}

export function resetEverything(): HomeCookData {
  return freshData();
}
