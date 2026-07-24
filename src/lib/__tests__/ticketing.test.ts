import { describe, it, expect } from 'vitest';
import {
  validateExternalTicketUrl,
  validateTicketingSelection,
  buildTicketingPayload,
} from '../ticketing';

describe('validateExternalTicketUrl', () => {
  it('rejects missing/blank urls', () => {
    expect(validateExternalTicketUrl(undefined)).toMatch(/required/i);
    expect(validateExternalTicketUrl(null)).toMatch(/required/i);
    expect(validateExternalTicketUrl('')).toMatch(/required/i);
    expect(validateExternalTicketUrl('   ')).toMatch(/required/i);
  });

  it('accepts an absolute https url', () => {
    expect(validateExternalTicketUrl('https://example.com/tickets')).toBeNull();
    expect(validateExternalTicketUrl('  https://example.com/tickets  ')).toBeNull();
  });

  it('rejects http:// urls', () => {
    expect(validateExternalTicketUrl('http://example.com/tickets')).toMatch(/https/i);
  });

  it('rejects javascript: urls', () => {
    expect(validateExternalTicketUrl('javascript:alert(1)')).toMatch(/https/i);
  });

  it('rejects data: urls', () => {
    expect(validateExternalTicketUrl('data:text/html,<script>alert(1)</script>')).toMatch(/https/i);
  });

  it('rejects malformed/relative urls', () => {
    expect(validateExternalTicketUrl('not a url')).toBeTruthy();
    expect(validateExternalTicketUrl('/relative/path')).toBeTruthy();
  });
});

describe('validateTicketingSelection', () => {
  it('requires nothing extra when carrot sells the tickets', () => {
    expect(validateTicketingSelection('carrot', undefined)).toBeNull();
    expect(validateTicketingSelection('carrot', '')).toBeNull();
    expect(validateTicketingSelection('carrot', 'javascript:alert(1)')).toBeNull();
  });

  it('requires a valid https url when selling externally', () => {
    expect(validateTicketingSelection('external', '')).toBeTruthy();
    expect(validateTicketingSelection('external', 'http://example.com')).toBeTruthy();
    expect(validateTicketingSelection('external', 'https://example.com')).toBeNull();
  });
});

describe('buildTicketingPayload', () => {
  it('carries ticketing + externalTicketUrl for external events', () => {
    expect(buildTicketingPayload('external', 'https://example.com/tix')).toEqual({
      ticketing: 'external',
      externalTicketUrl: 'https://example.com/tix',
    });
  });

  it('trims the url in the payload', () => {
    expect(buildTicketingPayload('external', '  https://example.com/tix  ')).toEqual({
      ticketing: 'external',
      externalTicketUrl: 'https://example.com/tix',
    });
  });

  it('omits externalTicketUrl for carrot events, even if one was previously typed', () => {
    expect(buildTicketingPayload('carrot', 'https://leftover.example.com')).toEqual({
      ticketing: 'carrot',
    });
  });
});
