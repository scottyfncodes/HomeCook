/**
 * The recommendation engine.
 *
 * Deliberately deterministic and inspectable: every candidate gets a small set
 * of scored components with a sentence attached, so "why this meal" is the
 * actual arithmetic rather than a story told afterwards. Nothing here calls a
 * model; the whole thing runs on the device in a few milliseconds.
 *
 *   score = taste + your ratings + budget fit + pantry + overlap
 *         − repetition − recency + time fit
 */
import type { HomeCookData, PlannedMeal, Recipe, WeekPlan } from '@homecook/core/types';
import { makeRng } from '@homecook/core/rng';
import { getStore } from '@homecook/data/stores';
import { isExcluded } from '@homecook/engine/constraints';
import { buildGroceryList } from '@homecook/engine/grocery';
import { plannableRecipes } from '@homecook/engine/library';
import { DAYS, dinersFor, householdSize } from '@homecook/engine/plan';
import { estimateMealCost, round2 } from '@homecook/engine/pricing';
import { planServings, scaledTime } from '@homecook/engine/scale';
import { buildTasteProfile, similarLikedCount, tasteScore, type TasteProfile } from '@homecook/engine/taste';
import { formatMoney } from '@homecook/engine/units';

export interface ScoreComponent {
  label: string;
  points: number;
}

export interface Candidate {
  recipe: Recipe;
  score: number;
  /** Sentences for "Why HomeCook picked this". */
  reasons: string[];
  /** Things worth knowing that counted against it. */
  cautions: string[];
  components: ScoreComponent[];
  cost: number;
  servings: number;
  diners: number;
  leftovers: number;
  time: number;
}

interface ScoreContext {
  data: HomeCookData;
  profile: TasteProfile;
  /** Other meals already on the week, for variety and shared ingredients. */
  weekRecipes: Recipe[];
  previous: Recipe | null;
  diners: number;
  extraServings: number;
  /** Ingredient-cost budget available to this meal. */
  allowance: number;
  storeFactor: number;
  pantryIds: Set<string>;
  daysSinceCooked: Map<string, number>;
}

function daysBetween(a: string, b: string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.round(ms / 86_400_000);
}

export function recentlyCooked(data: HomeCookData, today = new Date()): Map<string, number> {
  const iso = today.toISOString().slice(0, 10);
  const map = new Map<string, number>();
  for (const entry of data.history) {
    const days = daysBetween(entry.date, iso);
    if (days < 0) continue;
    const seen = map.get(entry.recipeId);
    if (seen === undefined || days < seen) map.set(entry.recipeId, days);
  }
  return map;
}

export function scoreCandidate(recipe: Recipe, ctx: ScoreContext): Candidate {
  const components: ScoreComponent[] = [];
  const reasons: string[] = [];
  const cautions: string[] = [];

  const serving = planServings(recipe, ctx.diners, ctx.data.settings.leftovers, ctx.extraServings);
  const cost = estimateMealCost(recipe, serving.servings, ctx.storeFactor);

  // 1. Taste profile.
  const taste = tasteScore(recipe, ctx.profile);
  components.push({ label: 'Taste profile', points: round2(taste * 30) });
  const liked = similarLikedCount(recipe, ctx.data);
  if (liked >= 2 && taste > 0.05) {
    reasons.push(`Similar to ${liked} meals you rated positively`);
  } else if (taste > 0.15) {
    reasons.push(`Matches your ${recipe.cuisine} / ${recipe.protein} leanings`);
  } else if (taste < -0.15) {
    cautions.push('Not much like the food you usually rate well');
  }

  // 2. What you said about this exact recipe.
  const rating = ctx.data.ratings[recipe.id];
  if (rating === 'loved') {
    components.push({ label: 'You loved it', points: 25 });
    reasons.push('You loved this last time');
  } else if (rating === 'good') {
    components.push({ label: 'You rated it good', points: 12 });
    reasons.push('You rated this good');
  } else if (rating === 'no') {
    components.push({ label: "You'd rather not", points: -40 });
    cautions.push("You said don't make this again");
  }

  // 3. Budget fit, against this meal's share of the week.
  if (ctx.allowance > 0) {
    const ratio = cost / ctx.allowance;
    const points = Math.max(-25, Math.min(14, (1 - ratio) * 20));
    components.push({ label: 'Budget fit', points: round2(points) });
    if (ratio <= 0.8) reasons.push(`${formatMoney(cost)} for ${serving.servings} servings — under budget`);
    else if (ratio > 1.3) cautions.push(`Pricier than the rest of the week (${formatMoney(cost)})`);
  }

  // 4. Pantry.
  const inPantry = recipe.ingredients.filter((item) => ctx.pantryIds.has(item.ingredientId)).length;
  if (inPantry > 0) {
    const points = Math.min(12, inPantry * 2);
    components.push({ label: 'Uses the pantry', points });
    if (inPantry >= 3) reasons.push(`Uses ${inPantry} things already in your pantry`);
  }

  // 5. Shared ingredients with the rest of the week.
  const weekIds = new Set(ctx.weekRecipes.flatMap((r) => r.ingredients.map((i) => i.ingredientId)));
  const shared = recipe.ingredients.filter(
    (item) => weekIds.has(item.ingredientId) && !ctx.pantryIds.has(item.ingredientId),
  ).length;
  if (shared > 0) {
    const points = Math.min(10, shared * 2.5);
    components.push({ label: 'Shares ingredients', points: round2(points) });
    if (shared >= 3) reasons.push(`Shares ${shared} ingredients with other meals this week`);
  }

  // 6. Variety across the week.
  let repetition = 0;
  const sameProtein = ctx.weekRecipes.filter((r) => r.protein === recipe.protein).length;
  const sameCuisine = ctx.weekRecipes.filter((r) => r.cuisine === recipe.cuisine).length;
  const sameFormat = ctx.weekRecipes.filter((r) => r.format === recipe.format).length;
  const sameMethod = ctx.weekRecipes.filter((r) => r.cookingMethod === recipe.cookingMethod).length;
  repetition -= sameProtein * 13 + sameCuisine * 8 + sameFormat * 6 + sameMethod * 3;
  if (repetition !== 0) components.push({ label: 'Variety', points: repetition });
  if (sameProtein > 0) cautions.push(`Another ${recipe.protein} night this week`);
  if (ctx.previous && ctx.previous.protein !== recipe.protein && sameProtein === 0) {
    reasons.push(`Different protein from ${ctx.previous.name}`);
  }

  // 7. Recently cooked.
  const days = ctx.daysSinceCooked.get(recipe.id);
  if (days !== undefined) {
    if (days <= 14) {
      components.push({ label: 'Cooked recently', points: -30 });
      cautions.push(days <= 1 ? 'You cooked this yesterday' : `You cooked this ${days} days ago`);
    } else if (days <= 35) {
      components.push({ label: 'Cooked this month', points: -10 });
    } else {
      components.push({ label: 'Not made in a while', points: 4 });
      reasons.push(`You haven't made this in ${Math.round(days / 7)} weeks`);
    }
  }

  // 8. Does it fit a weeknight?
  const time = scaledTime(recipe, serving.servings);
  if (time <= ctx.data.settings.maxCookMinutes) {
    components.push({ label: 'Fits your cooking time', points: 6 });
    if (time <= 35) reasons.push(`${time}-minute dinner`);
  } else {
    const points = -Math.min(18, (time - ctx.data.settings.maxCookMinutes) / 2);
    components.push({ label: 'Longer than usual', points: round2(points) });
    cautions.push(`Takes about ${time} minutes`);
  }

  // 9. Leftovers, when you want them.
  if (ctx.data.settings.leftovers !== 'none' && recipe.leftoverPotential === 'high') {
    components.push({ label: 'Good leftovers', points: 5 });
    if (serving.leftovers > 0) {
      reasons.push(
        `${serving.leftovers} serving${serving.leftovers === 1 ? '' : 's'} left over for later`,
      );
    }
  }

  const score = round2(components.reduce((sum, c) => sum + c.points, 0));
  return {
    recipe,
    score,
    reasons,
    cautions,
    components: components.sort((a, b) => Math.abs(b.points) - Math.abs(a.points)),
    cost,
    servings: serving.servings,
    diners: serving.diners,
    leftovers: serving.leftovers,
    time,
  };
}

/**
 * Regenerating should not hand back the same week every time, so the choice is
 * made from the candidates clustered near the top rather than always the single
 * highest score — weighted, so a clearly better meal still usually wins.
 */
const BAND = 12;

function pickFromBest(scored: Candidate[], rng: () => number): Candidate | null {
  const best = scored[0];
  if (!best) return null;
  const band = scored.filter((candidate) => candidate.score >= best.score - BAND).slice(0, 5);
  const weights = band.map((candidate) => candidate.score - (best.score - BAND) + 1);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = rng() * total;
  for (let index = 0; index < band.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return band[index]!;
  }
  return best;
}

function buildContext(
  data: HomeCookData,
  opts: {
    weekRecipes: Recipe[];
    previous: Recipe | null;
    diners: number;
    extraServings: number;
    allowance: number;
    profile: TasteProfile;
    daysSinceCooked: Map<string, number>;
  },
): ScoreContext {
  return {
    data,
    profile: opts.profile,
    weekRecipes: opts.weekRecipes,
    previous: opts.previous,
    diners: opts.diners,
    extraServings: opts.extraServings,
    allowance: opts.allowance,
    storeFactor: getStore(data.settings.storeId).factor,
    pantryIds: new Set(data.pantry.map((p) => p.ingredientId)),
    daysSinceCooked: opts.daysSinceCooked,
  };
}

/** Days for a week of `count` dinners, starting Monday. */
export function slotDays(count: number): string[] {
  return Array.from({ length: count }, (_, idx) => DAYS[idx % DAYS.length]!);
}

function blankMeal(day: string, index: number): PlannedMeal {
  return {
    id: `meal_${index}_${day.toLowerCase()}`,
    day,
    recipeId: null,
    locked: false,
    dinersOverride: null,
    extraServings: 0,
    cooked: false,
  };
}

/**
 * Reconcile the stored week with the number of meals wanted, keeping each day's
 * locks, headcount overrides and planned extras.
 */
export function ensureSlots(data: HomeCookData, count: number): PlannedMeal[] {
  const days = slotDays(count);
  return days.map((day, index) => {
    const existing = data.plan.meals[index];
    if (!existing) return blankMeal(day, index);
    return { ...existing, day, id: existing.id || blankMeal(day, index).id };
  });
}

export interface GenerateOptions {
  seed?: number;
  today?: Date;
  /** Clear every unlocked day first (the default) or fill only empty days. */
  fillOnly?: boolean;
}

export function generateWeek(data: HomeCookData, options: GenerateOptions = {}): WeekPlan {
  const seed = options.seed ?? Math.floor(Math.random() * 1_000_000);
  const rng = makeRng(seed);
  const profile = buildTasteProfile(data);
  const daysSinceCooked = recentlyCooked(data, options.today ?? new Date());
  const pool = plannableRecipes(data).filter((recipe) => !isExcluded(recipe, data));

  const meals = ensureSlots(data, data.settings.mealsPerWeek).map((meal) =>
    meal.locked ? { ...meal } : { ...meal, recipeId: options.fillOnly ? meal.recipeId : null, cooked: false },
  );

  const byId = new Map(pool.map((r) => [r.id, r]));
  const chosen = new Map<string, Recipe>();
  for (const meal of meals) {
    const recipe = meal.recipeId ? byId.get(meal.recipeId) : undefined;
    if (recipe) chosen.set(meal.id, recipe);
  }

  let spent = 0;
  for (const recipe of chosen.values()) {
    spent += estimateMealCost(recipe, recipe.servings, getStore(data.settings.storeId).factor);
  }

  meals.forEach((meal, index) => {
    if (chosen.has(meal.id)) return;
    const openSlots = meals.filter((m) => !chosen.has(m.id)).length;
    const allowance = Math.max(6, (data.settings.budget - spent) / Math.max(1, openSlots));
    const weekRecipes = [...chosen.values()];
    const previous = index > 0 ? chosen.get(meals[index - 1]!.id) ?? null : null;
    const diners = meal.dinersOverride ?? householdSize(data.household);

    const ctx = buildContext(data, {
      weekRecipes,
      previous,
      diners,
      extraServings: meal.extraServings,
      allowance,
      profile,
      daysSinceCooked,
    });

    const scored = pool
      .filter((recipe) => !weekRecipes.some((r) => r.id === recipe.id))
      .map((recipe) => scoreCandidate(recipe, ctx))
      .sort((a, b) => b.score - a.score);
    const picked = pickFromBest(scored, rng);
    if (!picked) return;
    chosen.set(meal.id, picked.recipe);
    meal.recipeId = picked.recipe.id;
    spent += picked.cost;
  });

  const plan: WeekPlan = { weekOf: weekOf(options.today ?? new Date()), seed, meals };
  return repairBudget({ ...data, plan }, pool, profile, daysSinceCooked);
}

/**
 * The greedy pass scores each meal on its own ingredient cost; the basket is
 * what actually gets paid. If the basket is over budget, trade the priciest
 * unlocked meal down until it fits or nothing better is available.
 */
function repairBudget(
  data: HomeCookData,
  pool: Recipe[],
  profile: TasteProfile,
  daysSinceCooked: Map<string, number>,
): WeekPlan {
  let current = data;
  let total = buildGroceryList(current).total;
  const budget = current.settings.budget;

  for (let attempt = 0; attempt < 8 && total > budget; attempt += 1) {
    const meals = current.plan.meals;
    const swappable = meals
      .map((meal, index) => ({ meal, index }))
      .filter(({ meal }) => !meal.locked && meal.recipeId)
      .map(({ meal, index }) => {
        const recipe = pool.find((r) => r.id === meal.recipeId)!;
        const diners = dinersFor(meal, current.household);
        const serving = planServings(recipe, diners, current.settings.leftovers, meal.extraServings);
        return {
          meal,
          index,
          recipe,
          cost: estimateMealCost(recipe, serving.servings, getStore(current.settings.storeId).factor),
        };
      })
      .filter((entry) => entry.recipe)
      .sort((a, b) => b.cost - a.cost);

    let improved = false;
    for (const entry of swappable) {
      const used = new Set(meals.map((m) => m.recipeId).filter(Boolean) as string[]);
      const ctx = buildContext(current, {
        weekRecipes: meals
          .filter((m) => m.id !== entry.meal.id && m.recipeId)
          .map((m) => pool.find((r) => r.id === m.recipeId))
          .filter((r): r is Recipe => Boolean(r)),
        previous: null,
        diners: dinersFor(entry.meal, current.household),
        extraServings: entry.meal.extraServings,
        allowance: Math.max(6, budget / Math.max(1, meals.length)),
        profile,
        daysSinceCooked,
      });

      const cheaper = pool
        .filter((r) => !used.has(r.id))
        .map((r) => scoreCandidate(r, ctx))
        .filter((c) => c.cost < entry.cost * 0.85)
        .sort((a, b) => b.score - a.score)[0];
      if (!cheaper) continue;

      const nextMeals = meals.map((m) =>
        m.id === entry.meal.id ? { ...m, recipeId: cheaper.recipe.id } : m,
      );
      const nextData = { ...current, plan: { ...current.plan, meals: nextMeals } };
      const nextTotal = buildGroceryList(nextData).total;
      if (nextTotal < total) {
        current = nextData;
        total = nextTotal;
        improved = true;
        break;
      }
    }
    if (!improved) break;
  }

  return current.plan;
}

export interface SwapOption extends Candidate {
  /** Change to the estimated basket total if this meal is swapped in. */
  costDelta: number;
}

/** Ranked alternatives for one day, with what each does to the basket. */
export function swapOptions(data: HomeCookData, mealId: string, limit = 6): SwapOption[] {
  const meal = data.plan.meals.find((m) => m.id === mealId);
  if (!meal) return [];

  const profile = buildTasteProfile(data);
  const daysSinceCooked = recentlyCooked(data);
  const pool = plannableRecipes(data).filter((recipe) => !isExcluded(recipe, data));
  const index = data.plan.meals.indexOf(meal);
  const used = new Set(
    data.plan.meals.filter((m) => m.id !== mealId).map((m) => m.recipeId).filter(Boolean) as string[],
  );
  const weekRecipes = pool.filter((r) => used.has(r.id));
  const previousMeal = index > 0 ? data.plan.meals[index - 1] : undefined;
  const previous = previousMeal?.recipeId ? pool.find((r) => r.id === previousMeal.recipeId) ?? null : null;

  const ctx = buildContext(data, {
    weekRecipes,
    previous,
    diners: dinersFor(meal, data.household),
    extraServings: meal.extraServings,
    allowance: Math.max(6, data.settings.budget / Math.max(1, data.plan.meals.length)),
    profile,
    daysSinceCooked,
  });

  const baseline = buildGroceryList(data).total;
  return pool
    .filter((recipe) => !used.has(recipe.id) && recipe.id !== meal.recipeId)
    .map((recipe) => scoreCandidate(recipe, ctx))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((candidate) => {
      const nextMeals = data.plan.meals.map((m) =>
        m.id === mealId ? { ...m, recipeId: candidate.recipe.id } : m,
      );
      const total = buildGroceryList({ ...data, plan: { ...data.plan, meals: nextMeals } }).total;
      return { ...candidate, costDelta: round2(total - baseline) };
    });
}

/** Why the meal currently on a day is there — the same maths, after the fact. */
export function explainMeal(data: HomeCookData, mealId: string): Candidate | null {
  const meal = data.plan.meals.find((m) => m.id === mealId);
  if (!meal?.recipeId) return null;
  const recipe = plannableRecipes(data).find((r) => r.id === meal.recipeId);
  if (!recipe) return null;

  const others = data.plan.meals
    .filter((m) => m.id !== mealId && m.recipeId)
    .map((m) => plannableRecipes(data).find((r) => r.id === m.recipeId))
    .filter((r): r is Recipe => Boolean(r));
  const index = data.plan.meals.indexOf(meal);
  const previousMeal = index > 0 ? data.plan.meals[index - 1] : undefined;
  const previous = previousMeal?.recipeId
    ? plannableRecipes(data).find((r) => r.id === previousMeal.recipeId) ?? null
    : null;

  const ctx = buildContext(data, {
    weekRecipes: others,
    previous,
    diners: dinersFor(meal, data.household),
    extraServings: meal.extraServings,
    allowance: Math.max(6, data.settings.budget / Math.max(1, data.plan.meals.length)),
    profile: buildTasteProfile(data),
    daysSinceCooked: recentlyCooked(data),
  });
  return scoreCandidate(recipe, ctx);
}

/** Monday of the week containing `date`, as an ISO day string. */
export function weekOf(date: Date): string {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}
