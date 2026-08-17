import { describe, it, expect } from 'vitest';
import { validateExternalPriceRange, buildPricePayload } from '@/lib/ticketing';

describe('validateExternalPriceRange', () => {
  it('passes when max >= min', () => expect(validateExternalPriceRange('100', '250')).toBeNull());
  it('passes with only a min', () => expect(validateExternalPriceRange('100', '')).toBeNull());
  it('fails when max < min', () => expect(validateExternalPriceRange('300', '100')).toMatch(/maximum/i));
});

describe('buildPricePayload', () => {
  it('sends currency for carrot events (no price bounds)', () =>
    expect(buildPricePayload('carrot', 'ZAR', '100', '250')).toEqual({ currency: 'ZAR' }));
  it('sends currency + numeric range for external', () =>
    expect(buildPricePayload('external', 'ZAR', '100', '250'))
      .toEqual({ currency: 'ZAR', priceMin: 100, priceMax: 250 }));
  it('omits empty price fields but keeps currency', () =>
    expect(buildPricePayload('external', 'SZL', '', '')).toEqual({ currency: 'SZL' }));
});
