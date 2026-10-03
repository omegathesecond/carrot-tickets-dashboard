import { describe, it, expect } from 'vitest';
import { stockBase, scopeKey, stallPath } from '@/lib/stockScope';
import { fmtCents, fmtR } from '@/lib/money';

describe('stockScope', () => {
  it('builds event and venue API bases', () => {
    expect(stockBase({ kind: 'event', eventId: 'e1' })).toBe('/tickets/events/e1');
    expect(stockBase({ kind: 'venue' })).toBe('/tickets/venue');
  });
  it('keys react-query caches per scope', () => {
    expect(scopeKey({ kind: 'event', eventId: 'e1' })).toBe('event:e1');
    expect(scopeKey({ kind: 'venue' })).toBe('venue');
  });
  it('routes a stall to its detail page', () => {
    expect(stallPath({ kind: 'event', eventId: 'e1' }, 'm1')).toBe('/events/e1/stalls/m1');
    expect(stallPath({ kind: 'venue' }, 'm1')).toBe('/venue/stalls/m1');
  });
});

describe('fmtCents', () => {
  // en-ZA writes a comma decimal ("R25,00" — money.test.ts pins the same for
  // fmtR), so the symbol changes with the currency and the digits do not.
  it('formats in the given currency; fmtR stays Rand', () => {
    expect(fmtCents(1250, 'SZL')).toBe('E12,50');
    expect(fmtCents(1250, 'ZAR')).toBe('R12,50');
    expect(fmtR(1250)).toBe('R12,50');
  });
});
