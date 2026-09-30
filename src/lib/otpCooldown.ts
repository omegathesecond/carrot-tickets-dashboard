/**
 * Shared bits of the OTP resend cooldown, so every surface that can request a
 * code counts down the same way.
 *
 * The backend (`OtpService`) refuses a second code to the same destination
 * inside a 60s window. Left unmirrored, the UI happily lets someone click
 * "resend" into a rejection and then shows a bare "Please wait 47 seconds..."
 * with nothing counting — which reads as a broken form rather than a wait.
 */

/**
 * The backend's per-destination resend window. Mirrored here so the countdown
 * can start the instant a code is sent, without waiting to be refused once.
 * If the server's window ever changes, a throttled response re-syncs us anyway
 * via `cooldownSecondsFrom` — this is the optimistic starting point, not the
 * source of truth.
 */
export const OTP_RESEND_COOLDOWN_SECONDS = 60;

/**
 * Seconds the server wants us to wait, or `null` when the failure wasn't a
 * throttle at all.
 *
 * Duck-typed on `retryAfterSeconds` rather than `instanceof RateLimitedError`:
 * an `instanceof` check quietly returns false whenever the module is duplicated
 * — two bundles, or a mocked `@/lib/api` — and the failure mode is a precise
 * countdown silently degrading into a dead-end error, exactly where it is
 * hardest to spot. Rounds up, so the button never enables a moment early and
 * walks the user into a second rejection.
 */
export function cooldownSecondsFrom(error: unknown): number | null {
  const seconds = (error as { retryAfterSeconds?: unknown } | null | undefined)?.retryAfterSeconds;
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) return null;
  return Math.ceil(seconds);
}

/** Label for a resend control: an invitation once the window is closed, a live
 *  countdown while it is open. */
export function resendLabel(secondsLeft: number): string {
  return secondsLeft > 0 ? `Resend code in ${secondsLeft}s` : 'Resend code';
}
