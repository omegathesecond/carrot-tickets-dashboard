// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TicketSalesPage } from '@/pages/TicketSalesPage';
import { apiClient } from '@/lib/api';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

/**
 * The event picker is a SearchableSelect — a popover + command list that
 * needs pointer APIs jsdom does not implement. Swapping in a native select
 * keeps this suite about the page's own logic (the basket, the totals, the
 * request body) rather than the picker's internals.
 */
vi.mock('@/components/ui/searchable-select', () => {
  const React = require('react');
  return {
    SearchableSelect: ({ value, onValueChange, options, placeholder }: any) =>
      React.createElement('select', {
        'aria-label': placeholder ?? 'select',
        value: value ?? '',
        onChange: (e: any) => onValueChange?.(e.target.value),
      }, [
        React.createElement('option', { key: '', value: '' }, placeholder ?? ''),
        ...options.map((o: any) => React.createElement('option', { key: o.value, value: o.value }, o.label)),
      ]),
  };
});




vi.mock('@/lib/api', () => ({
  apiClient: {
    events: { getEvents: vi.fn() },
    settings: { getPaymentMethods: vi.fn() },
    sales: { sellTickets: vi.fn() },
  },
}));

const EVENT = {
  _id: 'e1',
  name: 'Piano Republic',
  venue: 'Sibanesami Hotel',
  currency: 'SZL',
  ticketTypes: [
    { _id: 't1', name: 'General', price: 100, available: 50, isSoldOut: false },
    { _id: 't2', name: 'VIP', price: 250, available: 10, isSoldOut: false },
    { _id: 't3', name: 'Gone', price: 80, available: 0, isSoldOut: true },
  ],
};

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <TicketSalesPage />
    </QueryClientProvider>
  );
}

/**
 * Picks the event, which is what reveals the tier table.
 *
 * Radix's Select portals its listbox and needs pointer events jsdom does not
 * provide, so drive the hidden native <select> it renders for form
 * compatibility instead — that is the same state change a real click makes.
 */
async function chooseEvent() {
  // Wait for the OPTION, not just the select: the payment select exists
  // immediately, while the event options only appear once the query resolves.
  const option = await screen.findByRole('option', { name: /piano republic/i });
  fireEvent.change(option.closest('select')!, { target: { value: 'e1' } });
  await screen.findByTestId('sell-tier-t1');
}

const qtyFor = (tierName: string) => screen.getByLabelText(`Quantity for ${tierName}`);

beforeEach(() => {
  vi.mocked(apiClient.events.getEvents).mockResolvedValue({ data: [EVENT] } as never);
  vi.mocked(apiClient.settings.getPaymentMethods).mockResolvedValue({
    cashEnabled: true, keshlessWalletEnabled: false,
  } as never);
  vi.mocked(apiClient.sales.sellTickets).mockResolvedValue({ data: { tickets: [] } } as never);
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('TicketSalesPage — box-office basket', () => {
  it('offers a quantity per tier once an event is chosen', async () => {
    renderPage();
    await chooseEvent();

    expect(await screen.findByTestId('sell-tier-t1')).toBeTruthy();
    expect(screen.getByTestId('sell-tier-t2')).toBeTruthy();
    expect((qtyFor('General') as HTMLInputElement).disabled).toBe(false);
    expect((qtyFor('VIP') as HTMLInputElement).disabled).toBe(false);
  });

  it('disables a sold-out tier', async () => {
    renderPage();
    await chooseEvent();
    expect(await screen.findByTestId('sell-tier-t3')).toBeTruthy();
    expect((qtyFor('Gone') as HTMLInputElement).disabled).toBe(true);
  });

  it('totals a mixed basket across tiers', async () => {
    renderPage();
    await chooseEvent();

    fireEvent.change(await screen.findByLabelText('Quantity for General'), { target: { value: '2' } });
    fireEvent.change(qtyFor('VIP'), { target: { value: '1' } });

    await waitFor(() => expect(screen.getByTestId('summary-quantity').textContent).toContain('3'));
    // 2 × 100 + 1 × 250
    expect(screen.getByTestId('summary-total').textContent).toContain('450');
  });

  it('posts one sale carrying every line', async () => {
    renderPage();
    await chooseEvent();

    fireEvent.change(await screen.findByLabelText('Quantity for General'), { target: { value: '2' } });
    fireEvent.change(qtyFor('VIP'), { target: { value: '1' } });
    fireEvent.change(screen.getByPlaceholderText(/full name/i), { target: { value: 'Walk-up' } });
    fireEvent.change(screen.getByPlaceholderText('78422613'), { target: { value: '78422613' } });

    fireEvent.click(screen.getByRole('button', { name: /complete sale|sell/i }));

    await waitFor(() => expect(apiClient.sales.sellTickets).toHaveBeenCalled());
    const body = vi.mocked(apiClient.sales.sellTickets).mock.calls[0]![0] as unknown as Record<string, unknown>;
    expect(body['items']).toEqual([
      { ticketTypeId: 't1', quantity: 2 },
      { ticketTypeId: 't2', quantity: 1 },
    ]);
    // The legacy single-tier keys must be gone, not sent alongside.
    expect(body['ticketTypeId']).toBeUndefined();
    expect(body['quantity']).toBeUndefined();
  });

  it('refuses to submit an empty basket', async () => {
    const { toast } = await import('sonner');
    renderPage();
    await chooseEvent();

    fireEvent.change(await screen.findByPlaceholderText(/full name/i), { target: { value: 'Walk-up' } });
    fireEvent.change(screen.getByPlaceholderText('78422613'), { target: { value: '78422613' } });
    fireEvent.click(screen.getByRole('button', { name: /complete sale|sell/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/at least one ticket/i)));
    expect(apiClient.sales.sellTickets).not.toHaveBeenCalled();
  });

  it('clears the basket when the event changes', async () => {
    renderPage();
    await chooseEvent();
    fireEvent.change(await screen.findByLabelText('Quantity for General'), { target: { value: '2' } });
    await waitFor(() => expect(screen.getByTestId('summary-quantity').textContent).toContain('2'));

    // Re-selecting the event must not carry a stale basket into it.
    const option = screen.getByRole('option', { name: /piano republic/i });
    fireEvent.change(option.closest('select')!, { target: { value: 'e1' } });
    await waitFor(() => expect(screen.queryByTestId('summary-quantity')).toBeNull());
  });
});
