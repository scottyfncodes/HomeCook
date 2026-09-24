import { afterEach, describe, expect, it, vi } from 'vitest';
import { daysBetween, localIsoDate } from '@homecook/core/dates';
import { markCooked } from '@homecook/core/actions';
import { weekOf } from '@homecook/engine/planner';
import { makeData, withMeals } from './helpers';

/**
 * These hold in any time zone; run the suite with TZ=Asia/Tokyo or
 * TZ=America/Los_Angeles to see the UTC mistakes they guard against.
 */
describe('calendar days are local days', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('formats the local day, not the UTC one', () => {
    expect(localIsoDate(new Date(2026, 8, 21, 0, 30))).toBe('2026-09-21');
    expect(localIsoDate(new Date(2026, 8, 21, 23, 30))).toBe('2026-09-21');
  });

  it('starts the week on the local Monday', () => {
    expect(weekOf(new Date(2026, 8, 21, 0, 30))).toBe('2026-09-21');
    expect(weekOf(new Date(2026, 8, 23, 12))).toBe('2026-09-21');
    expect(weekOf(new Date(2026, 8, 27, 23, 30))).toBe('2026-09-21');
  });

  it('counts whole days across a clock change', () => {
    expect(daysBetween('2026-03-01', '2026-03-15')).toBe(14);
    expect(daysBetween('2026-10-20', '2026-11-03')).toBe(14);
  });

  it('files a late dinner under the evening it was cooked', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 22, 21, 45));
    const data = withMeals(makeData(), ['parmesan_garlic_chicken']);
    const cooked = markCooked(data, data.plan.meals[0]!.id, 'good');
    expect(cooked.history[0]!.date).toBe('2026-09-22');
  });
});
