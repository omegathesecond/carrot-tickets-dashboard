// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  OTP_RESEND_COOLDOWN_SECONDS,
  cooldownSecondsFrom,
  resendLabel,
} from '@/lib/otpCooldown';
import { RateLimitedError } from '@/lib/api';

/**
 * The countdown is only as trustworthy as what it reads off the error.
 *
 * `cooldownSecondsFrom` is duck-typed on `retryAfterSeconds` rather than
 * `instanceof RateLimitedError` on purpose: an `instanceof` check silently
 * returns false whenever the module is duplicated (two bundles, a mocked
 * `@/lib/api` in a test), which would degrade a precise countdown into a
 * dead-end error exactly where it is hardest to notice.
 */
describe('cooldownSecondsFrom', () => {
  it('reads the seconds off a throttled response', () => {
    expect(cooldownSecondsFrom(new RateLimitedError('Please wait 47 seconds...', 47))).toBe(47);
  });

  it('matches any error carrying retryAfterSeconds, not just our class', () => {
    expect(cooldownSecondsFrom({ retryAfterSeconds: 12 })).toBe(12);
  });

  it('rounds a fractional window up, so the button never enables early', () => {
    expect(cooldownSecondsFrom({ retryAfterSeconds: 4.2 })).toBe(5);
  });

  it('returns null for an ordinary failure', () => {
    expect(cooldownSecondsFrom(new Error('Could not send reset code'))).toBeNull();
  });

  it('returns null for junk rather than inventing a wait', () => {
    expect(cooldownSecondsFrom(null)).toBeNull();
    expect(cooldownSecondsFrom(undefined)).toBeNull();
    expect(cooldownSecondsFrom({ retryAfterSeconds: 0 })).toBeNull();
    expect(cooldownSecondsFrom({ retryAfterSeconds: -5 })).toBeNull();
    expect(cooldownSecondsFrom({ retryAfterSeconds: 'soon' })).toBeNull();
    expect(cooldownSecondsFrom({ retryAfterSeconds: Number.NaN })).toBeNull();
  });
});

describe('resendLabel', () => {
  it('invites a resend once the window has passed', () => {
    expect(resendLabel(0)).toBe('Resend code');
  });

  it('counts down in seconds while the window is open', () => {
    expect(resendLabel(47)).toBe('Resend code in 47s');
    expect(resendLabel(1)).toBe('Resend code in 1s');
  });
});

describe('OTP_RESEND_COOLDOWN_SECONDS', () => {
  it("mirrors the backend's 60s per-destination window", () => {
    expect(OTP_RESEND_COOLDOWN_SECONDS).toBe(60);
  });
});
