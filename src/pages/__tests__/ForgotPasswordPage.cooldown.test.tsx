// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import { apiClient } from '@/lib/api';

/**
 * An organizer who never gets the SMS needs two things this page did not have:
 * a way to ask again, and a visible answer to "when?".
 *
 * There was no resend control at all on the verify step — the only route back
 * was "Use a different email or phone", which re-requests immediately and lands
 * on the backend's 60s per-destination throttle. The organizer then saw a bare
 * "Please wait 47 seconds..." with nothing counting down, which reads as a
 * broken form rather than a wait.
 *
 * The clock here is fully faked and driven only by `tick()`. Two things this
 * file deliberately avoids:
 *  - `{ shouldAdvanceTime: true }`, which also lets REAL elapsed time tick the
 *    countdown, so a loaded full-suite run overshoots the asserted second and
 *    the test fails only when run alongside everything else.
 *  - `waitFor`, which polls the REAL clock a faked one never reaches.
 */
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ resetPassword: vi.fn(), user: null }),
}));

vi.mock('@/lib/api', () => ({
  apiClient: {
    auth: {
      requestPasswordReset: vi.fn(),
      resetPassword: vi.fn(),
    },
  },
  // Mirrors the real export's shape so the page's duck-typed read finds the
  // seconds — the very reason it doesn't use `instanceof`.
  RateLimitedError: class RateLimitedError extends Error {
    retryAfterSeconds: number;
    constructor(message: string, retryAfterSeconds: number) {
      super(message);
      this.name = 'RateLimitedError';
      this.retryAfterSeconds = retryAfterSeconds;
    }
  },
}));

const requestReset = apiClient.auth.requestPasswordReset as unknown as ReturnType<typeof vi.fn>;

/** A server that refuses another code for `seconds` more. */
async function throttledBy(seconds: number) {
  const { RateLimitedError } = await import('@/lib/api');
  return new RateLimitedError(
    `Please wait ${seconds} seconds before requesting another code.`,
    seconds
  );
}

/** Let pending promises and their state updates settle. No timers involved. */
const flush = () => act(async () => { await Promise.resolve(); });

/**
 * Advance the countdown a second at a time. The ticker schedules the next
 * `setTimeout` from an effect that runs only after React commits the previous
 * tick, so one big `advanceTimersByTime` fires exactly one timeout and then
 * finds nothing queued.
 */
async function tick(seconds: number) {
  for (let i = 0; i < seconds; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { vi.advanceTimersByTime(1000); });
  }
}

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/forgot-password']}>
      <ForgotPasswordPage />
    </MemoryRouter>
  );

/** Ask for a code as `org@x.com` and land on the verify step. */
async function sendCode() {
  requestReset.mockResolvedValue({ channel: 'email', identifier: 'org@x.com' });
  renderPage();
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'org@x.com' } });
  fireEvent.click(screen.getByRole('button', { name: /send reset code/i }));
  await flush();
  expect(screen.getByLabelText(/6-digit code/i)).toBeTruthy();
}

const button = (name: RegExp) => screen.getByRole('button', { name }) as HTMLButtonElement;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  vi.clearAllMocks();
});

describe('ForgotPasswordPage — resend cooldown', () => {
  it('offers a resend on the verify step, counting down from 60s', async () => {
    await sendCode();

    expect(button(/resend code in 60s/i).disabled).toBe(true);
  });

  it('ticks the countdown down as time passes', async () => {
    await sendCode();

    await tick(3);

    expect(button(/resend code in 57s/i)).toBeTruthy();
  });

  it('enables the resend once the window closes, and re-requests the code', async () => {
    await sendCode();
    expect(requestReset).toHaveBeenCalledTimes(1);

    await tick(60);
    expect(button(/^resend code$/i).disabled).toBe(false);

    fireEvent.click(button(/^resend code$/i));
    await flush();

    expect(requestReset).toHaveBeenCalledTimes(2);
    expect(requestReset).toHaveBeenLastCalledWith('org@x.com');
  });

  it('re-syncs the countdown to the server when it throttles a resend', async () => {
    await sendCode();
    await tick(60);

    // The client's window closed but the server's has not — a drifted clock.
    requestReset.mockRejectedValue(await throttledBy(18));
    fireEvent.click(button(/^resend code$/i));
    await flush();

    expect(button(/resend code in 18s/i).disabled).toBe(true);
  });

  it('counts down on the request step too, so a throttled first try is not a dead end', async () => {
    requestReset.mockRejectedValue(await throttledBy(42));
    renderPage();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'org@x.com' } });
    fireEvent.click(button(/send reset code/i));
    await flush();

    expect(button(/try again in 42s/i).disabled).toBe(true);
  });

  it('releases the countdown when a different destination is typed', async () => {
    requestReset.mockRejectedValue(await throttledBy(42));
    renderPage();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'org@x.com' } });
    fireEvent.click(button(/send reset code/i));
    await flush();
    expect(button(/try again in 42s/i)).toBeTruthy();

    // The throttle is keyed on the destination, so another address isn't throttled.
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'other@x.com' } });
    await flush();

    expect(button(/send reset code/i).disabled).toBe(false);
  });

  it('leaves an ordinary failure as a plain error with no countdown', async () => {
    requestReset.mockRejectedValue(new Error("We couldn't find an organizer account for this email or phone."));
    renderPage();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'nobody@x.com' } });
    fireEvent.click(button(/send reset code/i));
    await flush();

    expect(screen.getByRole('alert').textContent).toMatch(/couldn't find an organizer/i);
    expect(button(/send reset code/i).disabled).toBe(false);
  });
});
