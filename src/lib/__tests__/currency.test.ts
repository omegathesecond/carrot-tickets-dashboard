import { it, expect } from 'vitest';
import { currencySymbol, formatMoney, formatMoneyRange } from '@/lib/currency';

it("maps ZAR to 'R'", () => expect(currencySymbol('ZAR')).toBe('R'));
it("maps SZL to 'E'", () => expect(currencySymbol('SZL')).toBe('E'));
it("defaults undefined to 'E'", () => expect(currencySymbol(undefined)).toBe('E'));

it('formats SZL with E and ZAR with R', () => {
  expect(formatMoney(100, 'SZL')).toBe('E100');
  expect(formatMoney(100, 'ZAR')).toBe('R100');
});
it('spaced + fixed-decimal variant', () => {
  expect(formatMoney(1500, 'SZL', { space: true, decimals: 0 })).toBe('E 1,500');
});
it('formats a range', () => {
  expect(formatMoneyRange(100, 250, 'ZAR')).toBe('R100–R250');
  expect(formatMoneyRange(100, 100, 'SZL')).toBe('E100');
});
