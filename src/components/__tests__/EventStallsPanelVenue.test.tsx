// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { EventStallsPanel } from '@/components/cashless/EventStallsPanel';
import { apiClient } from '@/lib/api';
import type { StockScope } from '@/lib/stockScope';

vi.mock('@/lib/api', () => ({
  apiClient: {
    merchants: { list: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

function renderPanel(scope: StockScope) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <EventStallsPanel scope={scope} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Radix Dialog opens on the trigger's click; the form is portalled to the body. */
const openAddForm = () => fireEvent.click(screen.getByRole('button', { name: /add stall/i }));
const fillName = (name: string) =>
  fireEvent.change(screen.getByLabelText('Stall name'), { target: { value: name } });
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Create' }));

describe('EventStallsPanel scopes', () => {
  it('a venue lists its stalls, hides the commission field and creates without one', async () => {
    (apiClient.merchants.list as any).mockResolvedValue([{ _id: 'm1', name: 'Main Bar', commissionPercent: 0, status: 'active' }]);
    (apiClient.merchants.create as any).mockResolvedValue({ merchant: { _id: 'm2', name: 'Patio' } });
    renderPanel({ kind: 'venue' });
    expect(await screen.findByText('Main Bar')).toBeTruthy();
    expect(apiClient.merchants.list).toHaveBeenCalledWith({ kind: 'venue' });
    expect(screen.queryByText(/% commission/)).toBeNull();
    openAddForm();
    await screen.findByLabelText('Stall name');
    expect(screen.queryByLabelText('Commission %')).toBeNull();
    fillName('Patio');
    submit();
    await waitFor(() => expect(apiClient.merchants.create).toHaveBeenCalledWith({ kind: 'venue' }, { name: 'Patio' }));
  });

  it('an event still shows commission and creates with it', async () => {
    const scope: StockScope = { kind: 'event', eventId: 'e1' };
    (apiClient.merchants.list as any).mockResolvedValue([{ _id: 'm1', name: 'Main Bar', commissionPercent: 5, status: 'active' }]);
    (apiClient.merchants.create as any).mockResolvedValue({ merchant: { _id: 'm2', name: 'Patio' } });
    renderPanel(scope);
    expect(await screen.findByText('Main Bar')).toBeTruthy();
    expect(apiClient.merchants.list).toHaveBeenCalledWith(scope);
    expect(screen.getByText('5% commission')).toBeTruthy();
    openAddForm();
    await screen.findByLabelText('Stall name');
    expect(screen.getByLabelText('Commission %')).toBeTruthy();
    fillName('Patio');
    submit();
    await waitFor(() => expect(apiClient.merchants.create).toHaveBeenCalledWith(scope, { name: 'Patio', commissionPercent: 0 }));
  });

  it('says a venue stall sells (no bands at a venue) and keeps the event copy', async () => {
    (apiClient.merchants.list as any).mockResolvedValue([]);
    renderPanel({ kind: 'venue' });
    expect(await screen.findByText('No stalls yet')).toBeTruthy();
    expect(screen.getByText('Bars, food stalls and merch tables that sell at this venue')).toBeTruthy();
    expect(screen.getByText('Add a stall, then add the people who work its till so they can sell at this venue.')).toBeTruthy();
    expect(screen.queryByText(/bands/)).toBeNull();
    cleanup();

    renderPanel({ kind: 'event', eventId: 'e1' });
    expect(await screen.findByText('No stalls yet')).toBeTruthy();
    expect(screen.getByText('Bars, food stalls and merch tables that charge bands at this event, each with a commission cut')).toBeTruthy();
    expect(screen.getByText('Add a stall, then add the people who work its till so they can charge bands at this event.')).toBeTruthy();
  });
});
