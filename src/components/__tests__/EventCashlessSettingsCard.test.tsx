// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EventCashlessSettingsCard } from '@/components/EventCashlessSettingsCard';
import type { Event } from '@/types';

const updateEvent = vi.fn(async () => ({}) as Event);
const requestCashless = vi.fn(async () => ({ requestedAt: '2026-08-19T10:00:00.000Z' }));

vi.mock('@/lib/api', () => ({
  apiClient: {
    events: {
      updateEvent: (...a: unknown[]) => updateEvent(...(a as [])),
      requestCashless: (...a: unknown[]) => requestCashless(...(a as [])),
    },
  },
}));

const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: (...a: unknown[]) => toastError(...(a as [])) },
}));

afterEach(cleanup);
beforeEach(() => {
  updateEvent.mockClear();
  requestCashless.mockClear();
  toastError.mockClear();
});

function makeEvent(over: Partial<Event> = {}): Event {
  return { _id: 'evt1', name: 'Bushfire', cashless: false, ...over } as Event;
}

function renderCard(event: Event, isAdmin: boolean) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <EventCashlessSettingsCard event={event} isAdmin={isAdmin} />
    </QueryClientProvider>,
  );
}

describe('admin (grant side)', () => {
  it('shows the toggle to an admin', () => {
    renderCard(makeEvent(), true);
    expect(screen.getByRole('switch')).toBeTruthy();
  });

  it('turning it on sends cashless:true', async () => {
    renderCard(makeEvent(), true);
    fireEvent.click(screen.getByRole('switch'));
    await waitFor(() => expect(updateEvent).toHaveBeenCalledWith('evt1', { cashless: true }));
  });

  it('surfaces a failed grant instead of swallowing it', async () => {
    updateEvent.mockRejectedValueOnce(new Error('Only an administrator can change'));
    renderCard(makeEvent(), true);
    fireEvent.click(screen.getByRole('switch'));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Only an administrator can change'));
  });

  it('warns that turning it off is blocked once money has moved', () => {
    renderCard(makeEvent({ cashless: true }), true);
    expect(screen.getByText(/once money has moved/i)).toBeTruthy();
  });

  it('never offers an admin the request button', () => {
    renderCard(makeEvent(), true);
    expect(screen.queryByRole('button', { name: /request cashless/i })).toBeNull();
  });
});

describe('organizer (request side)', () => {
  it('offers a request button, not a toggle', () => {
    renderCard(makeEvent(), false);
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.getByRole('button', { name: /request cashless/i })).toBeTruthy();
  });

  it('sends the note with the request', async () => {
    renderCard(makeEvent(), false);
    fireEvent.change(screen.getByPlaceholderText(/anything Carrot should know/i), {
      target: { value: '3 bars, 2000 people' },
    });
    fireEvent.click(screen.getByRole('button', { name: /request cashless/i }));
    await waitFor(() =>
      expect(requestCashless).toHaveBeenCalledWith('evt1', '3 bars, 2000 people'),
    );
  });

  it('shows the pending state instead of the button once requested', () => {
    renderCard(makeEvent({ cashlessRequestedAt: '2026-08-19T10:00:00.000Z' }), false);
    expect(screen.queryByRole('button', { name: /request cashless/i })).toBeNull();
    expect(screen.getByText(/requested/i)).toBeTruthy();
  });

  it('surfaces a failed request instead of swallowing it', async () => {
    requestCashless.mockRejectedValueOnce(new Error('Event not found'));
    renderCard(makeEvent(), false);
    fireEvent.click(screen.getByRole('button', { name: /request cashless/i }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Event not found'));
  });

  it('tells an organizer it is already on, with no controls', () => {
    renderCard(makeEvent({ cashless: true }), false);
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.queryByRole('button', { name: /request cashless/i })).toBeNull();
    expect(screen.getByText(/cashless is on/i)).toBeTruthy();
  });
});
