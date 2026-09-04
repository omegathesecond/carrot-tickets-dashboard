// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EventCashlessSetting } from '@/components/cashless/EventCashlessSetting';
import type { Event } from '@/types';

afterEach(cleanup);

const setCashlessFn = vi.fn(async () => ({}));
const requestCashlessFn = vi.fn(async () => ({}));
vi.mock('@/lib/api', () => ({
  apiClient: {
    events: {
      setCashless: (...a: unknown[]) => setCashlessFn(...(a as [])),
      requestCashless: (...a: unknown[]) => requestCashlessFn(...(a as [])),
    },
  },
}));

// The two mutations must surface a failure rather than swallow it — the API
// refuses to turn cashless OFF once money has moved, and an admin who thinks
// they disabled a live event is the failure mode that matters.
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: (...a: unknown[]) => toastError(...(a as [])) },
}));

beforeEach(() => {
  setCashlessFn.mockClear();
  requestCashlessFn.mockClear();
  toastError.mockClear();
  setCashlessFn.mockResolvedValue({});
  requestCashlessFn.mockResolvedValue({});
});

const eventWith = (over: Partial<Event> = {}): Event =>
  ({ _id: 'e1', name: 'Show', cashless: false, ...over }) as Event;

function renderCard(event: Event, isAdmin: boolean) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <EventCashlessSetting event={event} isAdmin={isAdmin} />
    </QueryClientProvider>,
  );
}

describe('EventCashlessSetting', () => {
  it('gives an admin the switch, not the request button', () => {
    renderCard(eventWith(), true);
    expect(screen.getByRole('switch')).toBeDefined();
    expect(screen.queryByRole('button', { name: /request cashless/i })).toBeNull();
  });

  it('gives an organizer the request button, not the switch', () => {
    renderCard(eventWith(), false);
    expect(screen.getByRole('button', { name: /request cashless/i })).toBeDefined();
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('shows an organizer their pending request instead of asking again', () => {
    renderCard(eventWith({ cashlessRequestedAt: '2026-08-19T10:00:00Z' }), false);
    expect(screen.getByText(/requested on/i)).toBeDefined();
    expect(screen.queryByRole('button', { name: /request cashless/i })).toBeNull();
  });

  it("surfaces the organizer's note to the admin so they can act on it", () => {
    renderCard(
      eventWith({ cashlessRequestedAt: '2026-08-19T10:00:00Z', cashlessRequestNote: 'Two bars' }),
      true,
    );
    expect(screen.getByText(/Two bars/)).toBeDefined();
  });

  it('tells an organizer it is already on, with nothing to request', () => {
    renderCard(eventWith({ cashless: true }), false);
    expect(screen.getByText(/cashless is on for this event/i)).toBeDefined();
    expect(screen.queryByRole('button', { name: /request cashless/i })).toBeNull();
  });
});

describe('EventCashlessSetting — payloads and failures', () => {
  it('grants by sending cashless:true, not just flipping the UI', async () => {
    renderCard(eventWith(), true);
    fireEvent.click(screen.getByRole('switch'));
    await waitFor(() => expect(setCashlessFn).toHaveBeenCalledWith('e1', true));
  });

  it('surfaces a refused grant instead of swallowing it', async () => {
    setCashlessFn.mockRejectedValueOnce(new Error('Money has already moved'));
    renderCard(eventWith({ cashless: true }), true);
    fireEvent.click(screen.getByRole('switch'));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Money has already moved'));
  });

  it("sends the organizer's note with the request", async () => {
    renderCard(eventWith(), false);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '3 bars, 2000 people' } });
    fireEvent.click(screen.getByRole('button', { name: /request cashless/i }));
    await waitFor(() =>
      expect(requestCashlessFn).toHaveBeenCalledWith('e1', '3 bars, 2000 people'),
    );
  });

  it('surfaces a failed request instead of swallowing it', async () => {
    requestCashlessFn.mockRejectedValueOnce(new Error('Event not found'));
    renderCard(eventWith(), false);
    fireEvent.click(screen.getByRole('button', { name: /request cashless/i }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Event not found'));
  });
});
