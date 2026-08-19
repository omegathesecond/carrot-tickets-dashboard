// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EventCashlessSetting } from '@/components/cashless/EventCashlessSetting';
import type { Event } from '@/types';

afterEach(cleanup);

vi.mock('@/lib/api', () => ({
  apiClient: { events: { setCashless: vi.fn(), requestCashless: vi.fn() } },
}));

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
