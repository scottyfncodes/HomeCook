import { freshData, freshPlan } from '@homecook/core/persist';
import type { HomeCookData } from '@homecook/core/types';

/** A household record with a known shape, for tests that need a starting point. */
export function makeData(overrides: Partial<HomeCookData> = {}): HomeCookData {
  const base = freshData(1_700_000_000_000);
  return {
    ...base,
    plan: freshPlan(base.settings.mealsPerWeek),
    ...overrides,
  };
}

/** Put specific recipes on the week's days. */
export function withMeals(data: HomeCookData, recipeIds: (string | null)[]): HomeCookData {
  const plan = freshPlan(recipeIds.length);
  return {
    ...data,
    settings: { ...data.settings, mealsPerWeek: recipeIds.length },
    plan: {
      ...plan,
      meals: plan.meals.map((meal, index) => ({ ...meal, recipeId: recipeIds[index] ?? null })),
    },
  };
}

/** An in-memory stand-in for localStorage. */
export function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => map.delete(key),
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  } as Storage;
}
