import { describe, expect, it } from 'vitest';
import { planPages } from '../printJob';

describe('planPages', () => {
  it('no-QR mode: N full sheets of nulls', () => {
    const pages = planPages(null, 3, 10);
    expect(pages).toHaveLength(3);
    expect(pages[0]).toHaveLength(10);
    expect(pages[0].every((x) => x === null)).toBe(true);
  });
  it('QR mode: chunks ticketIds, last page partial', () => {
    const ids = Array.from({ length: 23 }, (_, i) => `TKT-${i}`);
    const pages = planPages(ids, 0 /* ignored in QR mode */, 10);
    expect(pages).toHaveLength(3);
    expect(pages[2]).toHaveLength(3);
    expect(pages[0][0]).toBe('TKT-0');
    expect(pages[2][2]).toBe('TKT-22');
  });
  it('rejects empty work', () => {
    expect(() => planPages(null, 0, 10)).toThrow();
    expect(() => planPages([], 0, 10)).toThrow();
  });
});
