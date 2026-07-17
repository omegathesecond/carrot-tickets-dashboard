import { describe, it, expect } from 'vitest';
import { COUNTRIES, DEFAULT_COUNTRY, PRIORITY_COUNT, flagOf, countryFromE164 } from '@/lib/countries';

describe('flagOf', () => {
  it('derives the flag emoji from the ISO-3166 alpha-2 code', () => {
    expect(flagOf('SZ')).toBe('🇸🇿');
    expect(flagOf('ZA')).toBe('🇿🇦');
  });

  it('is case-insensitive', () => {
    expect(flagOf('sz')).toBe(flagOf('SZ'));
  });
});

describe('COUNTRIES', () => {
  it('defaults to Eswatini and leads with it', () => {
    expect(DEFAULT_COUNTRY.iso2).toBe('SZ');
    expect(DEFAULT_COUNTRY.dialCode).toBe('+268');
    expect(COUNTRIES[0].iso2).toBe('SZ');
  });

  it('puts the SADC neighbours in the priority block', () => {
    expect(COUNTRIES.slice(0, PRIORITY_COUNT).map((c) => c.iso2)).toEqual([
      'SZ', 'ZA', 'MZ', 'ZW', 'LS', 'BW', 'NA',
    ]);
  });

  it('sorts everything after the priority block alphabetically by name', () => {
    const rest = COUNTRIES.slice(PRIORITY_COUNT).map((c) => c.name);
    expect(rest).toEqual([...rest].sort((a, b) => a.localeCompare(b)));
  });

  it('has no duplicate iso2 codes', () => {
    const codes = COUNTRIES.map((c) => c.iso2);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('gives every entry a +-prefixed numeric dial code', () => {
    for (const c of COUNTRIES) expect(c.dialCode).toMatch(/^\+\d{1,4}$/);
  });
});

describe('countryFromE164', () => {
  it('finds Eswatini from a full +268 number', () => {
    expect(countryFromE164('+26876123456')?.iso2).toBe('SZ');
  });

  it('finds South Africa from a +27 number', () => {
    expect(countryFromE164('+27821234567')?.iso2).toBe('ZA');
  });

  // The bug this guards: '+1' is a prefix of nothing here, but '+26' is a
  // prefix of '+268' — shortest-match would route +268 to a +26x country.
  // Longest dial code must win.
  it('prefers the LONGEST matching dial code', () => {
    expect(countryFromE164('+26876123456')?.dialCode).toBe('+268');
    expect(countryFromE164('+12125551234')?.dialCode).toBe('+1');
  });

  it('returns null for an unmatched or empty value', () => {
    expect(countryFromE164('')).toBeNull();
    expect(countryFromE164('+999999')).toBeNull();
    expect(countryFromE164('76123456')).toBeNull();
  });
});
