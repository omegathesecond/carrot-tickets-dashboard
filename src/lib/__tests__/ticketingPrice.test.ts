import { describe, it, expect } from 'vitest';
import { validateExternalPriceRange, buildExternalPricePayload } from '@/lib/ticketing';

describe('validateExternalPriceRange', () => {
  it('passes when max >= min', () => expect(validateExternalPriceRange('100', '250')).toBeNull());
  it('passes with only a min', () => expect(validateExternalPriceRange('100', '')).toBeNull());
  it('fails when max < min', () => expect(validateExternalPriceRange('300', '100')).toMatch(/maximum/i));
});

describe('buildExternalPricePayload', () => {
  it('returns {} for carrot events', () =>
    expect(buildExternalPricePayload('carrot', 'SZL', '100', '250')).toEqual({}));
  it('returns currency + numeric range for external', () =>
    expect(buildExternalPricePayload('external', 'ZAR', '100', '250'))
      .toEqual({ currency: 'ZAR', priceMin: 100, priceMax: 250 }));
  it('omits empty price fields but keeps currency', () =>
    expect(buildExternalPricePayload('external', 'SZL', '', '')).toEqual({ currency: 'SZL' }));
});
