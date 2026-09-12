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




vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { _id: 'u1', businessName: 'Sunbenc Group', role: 'tickets_owner' } }),
}));

// Capture the SaleData the page builds — the receipt, not the dialog body, is
// where a missing field surfaces, so assert on the handoff itself.
const dialogProps: any[] = [];
vi.mock('@/components/TicketSuccessDialog', () => ({
  TicketSuccessDialog: (props: any) => { dialogProps.push(props); return null; },
}));

vi.mock('@/lib/api', () => ({
  apiClient: {
    events: { getEvents: vi.fn() },
    settings: { getPaymentMethods: vi.fn() },
    sales: {
      sellTickets: vi.fn(),
      sendSaleSms: vi.fn(),
      setTicketRecipient: vi.fn(),
      sendTicket: vi.fn(),
    },
    ticketDocs: { ticketPdfBytes: vi.fn(), ticketBundlePdf: vi.fn() },
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
  vi.mocked(apiClient.sales.sellTickets).mockResolvedValue({
    sale: { _id: '66b1f0c2a4d3e5f6a7b8c9d0', paymentMethod: 'cash' },
    tickets: [{ ticketId: 'TIX-1' }, { ticketId: 'TIX-2' }, { ticketId: 'TIX-3' }],
  } as never);
});
afterEach(() => { cleanup(); vi.clearAllMocks(); dialogProps.length = 0; });

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

  // The dialog only renders totalAmount, so a SaleData missing unitPrice /
  // saleId / paymentMethod / operatorName looked fine and then blew up on
  // Print with "Cannot read properties of undefined (reading 'toLocaleString')".
  it('hands the dialog a complete SaleData the receipt can print', async () => {
    renderPage();
    await chooseEvent();

    fireEvent.change(await screen.findByLabelText('Quantity for General'), { target: { value: '2' } });
    fireEvent.change(qtyFor('VIP'), { target: { value: '1' } });
    fireEvent.change(screen.getByPlaceholderText(/full name/i), { target: { value: 'Walk-up' } });
    fireEvent.change(screen.getByPlaceholderText('78422613'), { target: { value: '78422613' } });
    fireEvent.click(screen.getByRole('button', { name: /complete sale|sell/i }));

    await waitFor(() => expect(dialogProps.length).toBeGreaterThan(0));
    const sale = dialogProps[dialogProps.length - 1]!.saleData;

    // Read straight off the response — the ticket IDs are what become the QR
    // codes, and the sale id is what the "Send via SMS" button needs.
    expect(sale.ticketIds).toEqual(['TIX-1', 'TIX-2', 'TIX-3']);
    expect(sale.saleId).toBe('66b1f0c2a4d3e5f6a7b8c9d0');

    // Printed on the receipt, absent from the dialog body.
    expect(sale.paymentMethod).toBe('Cash');
    expect(sale.operatorName).toBe('Sunbenc Group');
    expect(sale.venue).toBe('Sibanesami Hotel');
    expect(sale.totalAmount).toBe(450);
    // A mixed basket has no single unit price — better unset than invented.
    expect(sale.unitPrice).toBeUndefined();
  });

  it('carries the unit price for a single-tier basket', async () => {
    renderPage();
    await chooseEvent();

    fireEvent.change(await screen.findByLabelText('Quantity for VIP'), { target: { value: '2' } });
    fireEvent.change(screen.getByPlaceholderText(/full name/i), { target: { value: 'Walk-up' } });
    fireEvent.change(screen.getByPlaceholderText('78422613'), { target: { value: '78422613' } });
    fireEvent.click(screen.getByRole('button', { name: /complete sale|sell/i }));

    await waitFor(() => expect(dialogProps.length).toBeGreaterThan(0));
    expect(dialogProps[dialogProps.length - 1]!.saleData.unitPrice).toBe(250);
  });

  // The dialog is shared with the reseller POS, whose rail authenticates with a
  // different token against a different endpoint. Wiring the wrong one is how
  // "Send via SMS" produced "No authorization header provided" for organizers.
  it('wires the dialog to the organizer SMS rail, not the reseller one', async () => {
    renderPage();
    await chooseEvent();

    fireEvent.change(await screen.findByLabelText('Quantity for General'), { target: { value: '1' } });
    fireEvent.change(screen.getByPlaceholderText(/full name/i), { target: { value: 'Walk-up' } });
    fireEvent.change(screen.getByPlaceholderText('78422613'), { target: { value: '78422613' } });
    fireEvent.click(screen.getByRole('button', { name: /complete sale|sell/i }));

    await waitFor(() => expect(dialogProps.length).toBeGreaterThan(0));
    expect(dialogProps[dialogProps.length - 1]!.sendSms).toBe(apiClient.sales.sendSaleSms);
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

  it('sends per-ticket recipients when the optional section is filled', async () => {
    renderPage();
    await chooseEvent();

    fireEvent.change(await screen.findByLabelText('Quantity for General'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: /assign tickets to individual people/i }));

    fireEvent.change(screen.getByLabelText('Recipient 1 name'), { target: { value: 'Thandi' } });
    fireEvent.change(screen.getByLabelText('Recipient 1 phone'), { target: { value: '76111111' } });

    fireEvent.change(screen.getByPlaceholderText(/full name/i), { target: { value: 'Walk-up' } });
    fireEvent.change(screen.getByPlaceholderText('78422613'), { target: { value: '78422613' } });
    fireEvent.click(screen.getByRole('button', { name: /complete sale|sell/i }));

    await waitFor(() => expect(apiClient.sales.sellTickets).toHaveBeenCalled());
    const body = vi.mocked(apiClient.sales.sellTickets).mock.calls[0]![0] as any;
    expect(body.items[0].recipients[0]).toMatchObject({ name: 'Thandi' });
  });

  it('sends no recipients key when the section is untouched', async () => {
    renderPage();
    await chooseEvent();
    fireEvent.change(await screen.findByLabelText('Quantity for General'), { target: { value: '2' } });
    fireEvent.change(screen.getByPlaceholderText(/full name/i), { target: { value: 'Walk-up' } });
    fireEvent.change(screen.getByPlaceholderText('78422613'), { target: { value: '78422613' } });
    fireEvent.click(screen.getByRole('button', { name: /complete sale|sell/i }));

    await waitFor(() => expect(apiClient.sales.sellTickets).toHaveBeenCalled());
    const body = vi.mocked(apiClient.sales.sellTickets).mock.calls[0]![0] as any;
    expect(body.items[0].recipients).toBeUndefined();
  });

  it('drops a typed-then-cleared trailing recipient instead of shipping a blank name', async () => {
    renderPage();
    await chooseEvent();

    fireEvent.change(await screen.findByLabelText('Quantity for General'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: /assign tickets to individual people/i }));

    // Ordinary typo correction: type into recipient 1's name, then backspace
    // it clear. Recipient 2 is never touched. Naively this leaves
    // `{ name: '' }` in state for index 0 — one key, so a check for
    // `Object.keys(entry).length === 0` would (wrongly) treat it as non-blank
    // and ship a real recipient with a blank name.
    fireEvent.change(screen.getByLabelText('Recipient 1 name'), { target: { value: 'Thandi' } });
    fireEvent.change(screen.getByLabelText('Recipient 1 name'), { target: { value: '' } });

    fireEvent.change(screen.getByPlaceholderText(/full name/i), { target: { value: 'Walk-up' } });
    fireEvent.change(screen.getByPlaceholderText('78422613'), { target: { value: '78422613' } });
    fireEvent.click(screen.getByRole('button', { name: /complete sale|sell/i }));

    await waitFor(() => expect(apiClient.sales.sellTickets).toHaveBeenCalled());
    const body = vi.mocked(apiClient.sales.sellTickets).mock.calls[0]![0] as any;
    expect(body.items[0].recipients).toBeUndefined();
  });

  it('strips an interior recipient\'s typed-then-cleared field instead of shipping it empty', async () => {
    renderPage();
    await chooseEvent();

    fireEvent.change(await screen.findByLabelText('Quantity for General'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: /assign tickets to individual people/i }));

    fireEvent.change(screen.getByLabelText('Recipient 1 name'), { target: { value: 'Thandi' } });
    // Typo correction on recipient 1's phone: typed, then cleared. Recipient
    // 1 is interior (recipient 2 has real content), so the trailing-trim
    // never runs on it — normalization must strip the empty field itself.
    fireEvent.change(screen.getByLabelText('Recipient 1 phone'), { target: { value: '76111111' } });
    fireEvent.change(screen.getByLabelText('Recipient 1 phone'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Recipient 2 name'), { target: { value: 'Sipho' } });

    fireEvent.change(screen.getByPlaceholderText(/full name/i), { target: { value: 'Walk-up' } });
    fireEvent.change(screen.getByPlaceholderText('78422613'), { target: { value: '78422613' } });
    fireEvent.click(screen.getByRole('button', { name: /complete sale|sell/i }));

    await waitFor(() => expect(apiClient.sales.sellTickets).toHaveBeenCalled());
    const body = vi.mocked(apiClient.sales.sellTickets).mock.calls[0]![0] as any;
    expect(body.items[0].recipients).toEqual([{ name: 'Thandi' }, { name: 'Sipho' }]);
    expect(body.items[0].recipients[0]).not.toHaveProperty('phone');
  });

  it('gives the dialog the organizer per-ticket rails', async () => {
    renderPage();
    await chooseEvent();
    fireEvent.change(await screen.findByLabelText('Quantity for General'), { target: { value: '1' } });
    fireEvent.change(screen.getByPlaceholderText(/full name/i), { target: { value: 'Walk-up' } });
    fireEvent.change(screen.getByPlaceholderText('78422613'), { target: { value: '78422613' } });
    fireEvent.click(screen.getByRole('button', { name: /complete sale|sell/i }));

    await waitFor(() => expect(dialogProps.length).toBeGreaterThan(0));
    const p = dialogProps[dialogProps.length - 1]!;
    expect(p.perTicket.setRecipient).toBe(apiClient.sales.setTicketRecipient);
    expect(p.perTicket.send).toBe(apiClient.sales.sendTicket);
  });
});
