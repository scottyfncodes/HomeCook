import { describe, expect, it } from 'vitest';
import { RECIPES } from '@homecook/data/recipes';
import { resolveWeek, upNext } from '@homecook/engine/plan';
import { makeData, withMeals } from './helpers';

// Wednesday 4 March 2026, local noon; that week's Monday is the 2nd.
const WEDNESDAY = new Date(2026, 2, 4, 12);
const WEEK_OF = '2026-03-02';

function week(ids: (string | null)[], cooked: number[] = []) {
  const data = withMeals(makeData(), ids);
  const meals = data.plan.meals.map((meal, index) => ({ ...meal, cooked: cooked.includes(index) }));
  return resolveWeek({ ...data, plan: { ...data.plan, weekOf: WEEK_OF, meals } });
}

const ids = RECIPES.slice(0, 5).map((recipe) => recipe.id);

describe('what to cook next', () => {
  it("is tonight's dinner when today is planned", () => {
    const next = upNext(week(ids), WEEK_OF, WEDNESDAY);
    expect(next?.tonight).toBe(true);
    expect(next?.item.meal.day).toBe('Wednesday');
  });

  it('moves on to the next day once tonight is cooked', () => {
    const next = upNext(week(ids, [2]), WEEK_OF, WEDNESDAY);
    expect(next?.tonight).toBe(false);
    expect(next?.item.meal.day).toBe('Thursday');
  });

  it('skips an empty day', () => {
    const next = upNext(week([ids[0]!, ids[1]!, null, null, ids[4]!]), WEEK_OF, WEDNESDAY);
    expect(next?.item.meal.day).toBe('Friday');
  });

  it('never points back at an earlier day of this week', () => {
    expect(upNext(week([ids[0]!, ids[1]!, null, null, null]), WEEK_OF, WEDNESDAY)).toBeNull();
  });

  it("starts from the top of a plan made in an earlier week", () => {
    const next = upNext(week(ids), '2026-02-23', WEDNESDAY);
    expect(next?.tonight).toBe(false);
    expect(next?.item.meal.day).toBe('Monday');
  });
});
