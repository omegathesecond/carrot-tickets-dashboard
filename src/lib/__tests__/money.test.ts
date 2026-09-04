import { describe, it, expect } from 'vitest';
import { fmtR, randToCents, centsToRand } from '@/lib/money';

describe('money helpers', () => {
  it('fmtR formats integer cents as rand (en-ZA: comma decimal)', () => {
    expect(fmtR(2500)).toBe('R25,00');
    expect(fmtR(0)).toBe('R0,00');
    // grouping separator is locale whitespace (space / narrow no-break space)
    expect(fmtR(123450)).toMatch(/^R1[\s  ]234,50$/);
  });

  it('randToCents parses rand to integer cents', () => {
    expect(randToCents('25')).toBe(2500);
    expect(randToCents('25.5')).toBe(2550);
    expect(randToCents('1,250.00')).toBe(125000);
    expect(randToCents(' 10 ')).toBe(1000);
  });

  it('randToCents returns null for blank/invalid (no silent 0)', () => {
    expect(randToCents('')).toBeNull();
    expect(randToCents('abc')).toBeNull();
    expect(randToCents('-5')).toBeNull();
  });

  it('centsToRand round-trips for the edit form', () => {
    expect(centsToRand(2500)).toBe('25.00');
    expect(randToCents(centsToRand(2550))).toBe(2550);
  });
});
