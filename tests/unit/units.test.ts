import { describe, expect, it } from 'vitest';
import { canConvert, convert, formatAmount, formatMinutes, formatMoney, formatQty } from '@homecook/engine/units';

describe('unit conversion', () => {
  it('converts inside the mass family', () => {
    expect(convert(1, 'lb', 'oz')).toBeCloseTo(16, 2);
    expect(convert(1000, 'g', 'kg')).toBeCloseTo(1, 6);
    expect(convert(2, 'kg', 'lb')).toBeCloseTo(4.409, 2);
  });

  it('converts inside the volume family', () => {
    expect(convert(1, 'cup', 'tbsp')).toBeCloseTo(16, 1);
    expect(convert(3, 'tsp', 'tbsp')).toBeCloseTo(1, 2);
  });

  it('refuses to cross families', () => {
    expect(canConvert('cup', 'lb')).toBe(false);
    expect(convert(1, 'cup', 'lb')).toBeNull();
  });

  it('keeps counted things distinct from each other', () => {
    expect(canConvert('clove', 'can')).toBe(false);
    expect(convert(2, 'clove', 'clove')).toBe(2);
  });
});

describe('formatting', () => {
  it('writes kitchen fractions', () => {
    expect(formatQty(1.5)).toBe('1½');
    expect(formatQty(0.25)).toBe('¼');
    expect(formatQty(2)).toBe('2');
    expect(formatQty(0.999)).toBe('1');
    expect(formatQty(340)).toBe('340');
  });

  it('falls back to a decimal when no fraction is close', () => {
    expect(formatQty(1.07)).toBe('1.07');
  });

  it('pluralises counted units and leaves bare counts alone', () => {
    expect(formatAmount(2, 'clove')).toBe('2 cloves');
    expect(formatAmount(1, 'can')).toBe('1 can');
    expect(formatAmount(3, 'count')).toBe('3');
    expect(formatAmount(1.5, 'lb')).toBe('1½ lb');
  });

  it('snaps counted things to quarters rather than showing 0.38 of a bunch', () => {
    expect(formatAmount(0.375, 'bunch')).toBe('½ bunch');
    expect(formatAmount(2.2, 'count')).toBe('2¼');
    expect(formatAmount(0.05, 'clove')).toBe('¼ clove');
    expect(formatAmount(0, 'bunch')).toBe('0 bunch');
    expect(formatAmount(1.6, 'cup')).toBe('1.6 cup');
  });

  it('formats money and time', () => {
    expect(formatMoney(12.5)).toBe('$12.50');
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(95)).toBe('1h 35m');
    expect(formatMinutes(120)).toBe('2h');
  });
});
