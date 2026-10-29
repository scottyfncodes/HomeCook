/**
 * Turning the stored week into the numbers every screen needs: who is eating,
 * how many servings that means, what it costs, how long it takes.
 */
import type { HomeCookData, Household, PlannedMeal, Recipe } from '@homecook/core/types';
import { localIsoDate } from '@homecook/core/dates';
import { getStore } from '@homecook/data/stores';
import { findRecipe } from '@homecook/engine/library';
import { estimateMealCost, round2 } from '@homecook/engine/pricing';
import { planServings, scaledTime, type ServingPlan } from '@homecook/engine/scale';

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function householdSize(household: Household): number {
  return Math.max(1, household.adults + household.children + household.guests);
}

/** The headcount for one meal: the override if set, otherwise the household. */
export function dinersFor(meal: PlannedMeal, household: Household): number {
  return meal.dinersOverride ?? householdSize(household);
}

export interface ResolvedMeal extends ServingPlan {
  meal: PlannedMeal;
  recipe: Recipe | null;
  /** Estimated ingredient cost for this meal at this size. */
  cost: number;
  /** Total hands-on + cooking minutes at this size. */
  time: number;
}

export function resolveMeal(data: HomeCookData, meal: PlannedMeal): ResolvedMeal {
  const recipe = findRecipe(data, meal.recipeId) ?? null;
  const diners = dinersFor(meal, data.household);
  if (!recipe) {
    return { meal, recipe: null, diners, servings: 0, leftovers: 0, factor: 0, cost: 0, time: 0 };
  }
  const serving = planServings(recipe, diners, data.settings.leftovers, meal.extraServings);
  const factor = getStore(data.settings.storeId).factor;
  return {
    meal,
    recipe,
    ...serving,
    cost: estimateMealCost(recipe, serving.servings, factor),
    time: scaledTime(recipe, serving.servings),
  };
}

export function resolveWeek(data: HomeCookData): ResolvedMeal[] {
  return data.plan.meals.map((meal) => resolveMeal(data, meal));
}

export interface WeekTotals {
  meals: number;
  plannedMeals: number;
  diners: number;
  servings: number;
  leftovers: number;
  /** Sum of per-meal ingredient costs — not the basket total. */
  ingredientCost: number;
}

export function weekTotals(resolved: ResolvedMeal[]): WeekTotals {
  let diners = 0;
  let servings = 0;
  let leftovers = 0;
  let cost = 0;
  let planned = 0;
  for (const r of resolved) {
    if (!r.recipe) continue;
    planned += 1;
    diners += r.diners;
    servings += r.servings;
    leftovers += r.leftovers;
    cost += r.cost;
  }
  return {
    meals: resolved.length,
    plannedMeals: planned,
    diners,
    servings,
    leftovers,
    ingredientCost: round2(cost),
  };
}

export interface UpNext {
  item: ResolvedMeal;
  /** True when the meal is planned for today, in this week's plan. */
  tonight: boolean;
}

/**
 * The dinner to put first on the plan: today's, if it is planned and not yet
 * cooked; otherwise the next uncooked one later in the week. A plan left over
 * from an earlier week has no "today", so its first uncooked meal is next.
 */
export function upNext(resolved: ResolvedMeal[], weekOf: string, now: Date = new Date()): UpNext | null {
  const monday = new Date(now);
  monday.setDate(monday.getDate() - ((now.getDay() + 6) % 7));
  const current = localIsoDate(monday) === weekOf;
  const todayIndex = current ? (now.getDay() + 6) % 7 : -1;

  const waiting = resolved.filter((r) => r.recipe && !r.meal.cooked);
  const today = waiting.find((r) => DAYS.indexOf(r.meal.day) === todayIndex);
  if (today) return { item: today, tonight: true };
  const later = waiting.find((r) => DAYS.indexOf(r.meal.day) > todayIndex);
  return later ? { item: later, tonight: false } : null;
}
