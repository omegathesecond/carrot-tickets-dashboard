// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';
import { EventMenuTab } from '@/components/EventMenuTab';
import type { MenuOrderRow } from '@/lib/api';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

const listItems = vi.fn();
const listOrders = vi.fn();
const scanOrder = vi.fn();
const collectOrder = vi.fn();
const listMerchants = vi.fn();
const listProducts = vi.fn();

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    apiClient: {
      menu: {
        listItems: (...a: unknown[]) => listItems(...a),
        listOrders: (...a: unknown[]) => listOrders(...a),
        scanOrder: (...a: unknown[]) => scanOrder(...a),
        collectOrder: (...a: unknown[]) => collectOrder(...a),
        updateOrderFulfillment: vi.fn().mockResolvedValue({}),
      },
      merchants: { list: (...a: unknown[]) => listMerchants(...a) },
      stock: { listProducts: (...a: unknown[]) => listProducts(...a) },
    },
  };
});

const READY_ORDER: MenuOrderRow = {
  _id: 'o1',
  orderId: 'MENU-ABC123',
  eventId: 'e1',
  buyerId: 'b1',
  buyerName: 'Sipho',
  items: [{ menuItemId: 'm1', name: 'Lager', unitPrice: 2500, quantity: 2, lineTotal: 5000 }],
  subtotal: 5000,
  serviceFeeAmount: 400,
  amountCharged: 5400,
  paymentMethod: 'keshless_wallet',
  paymentStatus: 'completed',
  fulfillmentStatus: 'ready',
  createdAt: '2026-09-05T00:00:00.000Z',
  updatedAt: '2026-09-05T00:00:00.000Z',
};

beforeEach(() => {
  listItems.mockResolvedValue([]);
  listOrders.mockResolvedValue([]);
  listMerchants.mockResolvedValue([]);
  listProducts.mockResolvedValue([]);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Radix's TabsTrigger selects on POINTER-DOWN, not click — see
// EventStockReportTabs.test.tsx's identical helper.
const openTab = (el: HTMLElement) => {
  fireEvent.pointerDown(el, { button: 0, ctrlKey: false, pointerType: 'mouse' });
  fireEvent.mouseDown(el, { button: 0 });
  fireEvent.click(el);
};

const renderOnOrdersTab = async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <EventMenuTab eventId="e1" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  openTab(await screen.findByRole('tab', { name: /preorders/i }));
  await screen.findByText(/collect an order/i);
};

describe('EventMenuTab — collection scanner', () => {
  it('looks up an order by its code and previews it before collecting', async () => {
    scanOrder.mockResolvedValue(READY_ORDER);
    await renderOnOrdersTab();

    fireEvent.change(screen.getByPlaceholderText('6001240100015'), { target: { value: 'MENU-ABC123' } });
    fireEvent.click(screen.getByRole('button', { name: /look up order/i }));

    expect(await screen.findByText('MENU-ABC123')).toBeTruthy();
    expect(screen.getByText(/Sipho/)).toBeTruthy();
    expect(scanOrder).toHaveBeenCalledWith('MENU-ABC123');
    // Not yet collected — the confirm button is offered, not the "already collected" state.
    const confirmBtn = screen.getByRole('button', { name: /confirm collection/i }) as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(false);
  });

  it('confirms collection and refreshes the orders list', async () => {
    scanOrder.mockResolvedValue(READY_ORDER);
    collectOrder.mockResolvedValue({ ...READY_ORDER, fulfillmentStatus: 'collected', collectedAt: '2026-09-09T10:00:00.000Z' });
    await renderOnOrdersTab();

    fireEvent.change(screen.getByPlaceholderText('6001240100015'), { target: { value: 'MENU-ABC123' } });
    fireEvent.click(screen.getByRole('button', { name: /look up order/i }));
    fireEvent.click(await screen.findByRole('button', { name: /confirm collection/i }));

    expect(await screen.findByText(/already collected/i)).toBeTruthy();
    expect(collectOrder).toHaveBeenCalledWith('MENU-ABC123');
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Order collected'));
  });

  it('surfaces an unknown code as an error, not a silent no-op', async () => {
    scanOrder.mockRejectedValue(new Error('Order not found'));
    await renderOnOrdersTab();

    fireEvent.change(screen.getByPlaceholderText('6001240100015'), { target: { value: 'BOGUS' } });
    fireEvent.click(screen.getByRole('button', { name: /look up order/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Order not found'));
    expect(screen.queryByText('Buyer:', { exact: false })).toBeNull();
  });

  it('re-scanning an already-collected order shows the redeemed state, not a re-collect button', async () => {
    scanOrder.mockResolvedValue({ ...READY_ORDER, fulfillmentStatus: 'collected', collectedAt: '2026-09-01T08:30:00.000Z' });
    await renderOnOrdersTab();

    fireEvent.change(screen.getByPlaceholderText('6001240100015'), { target: { value: 'MENU-ABC123' } });
    fireEvent.click(screen.getByRole('button', { name: /look up order/i }));

    expect(await screen.findByText(/already collected/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /confirm collection/i })).toBeNull();
  });
});
