// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup, within, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { EventCataloguePanel } from '@/components/cashless/EventCataloguePanel';

afterEach(cleanup);

const PRODUCT = {
  _id: 'p1',
  name: 'Castle Lite 330ml',
  category: 'beer',
  price: 2500,
  barcode: '6001240100015',
  unitLabel: 'unit',
  unitsPerPack: 24,
  packLabel: 'case',
  active: true,
};

const PRODUCT_OFF = {
  _id: 'p2',
  name: 'Old Cider',
  category: 'beer',
  price: 3500,
  barcode: null,
  unitLabel: 'unit',
  unitsPerPack: null,
  packLabel: null,
  active: false,
};

const BOARD = {
  event: { id: 'e1', name: 'Cashless Tap Test' },
  perBar: [{
    merchantId: 'm1', merchantName: 'Main Bar',
    productId: 'p1', productName: 'Castle Lite 330ml', category: 'beer',
    onHand: 94, unitsSold: 30, revenue: 500000,
    lowStockThreshold: null, status: 'in_stock',
  }, {
    merchantId: 'm1', merchantName: 'Main Bar',
    productId: 'p2', productName: 'Old Cider', category: 'beer',
    onHand: 40, unitsSold: 0, revenue: 0,
    lowStockThreshold: null, status: 'in_stock',
  }],
  byProduct: [{
    productId: 'p1', productName: 'Castle Lite 330ml', category: 'beer',
    totalOnHand: 94, unitsSold: 30, revenue: 500000, status: 'in_stock',
  }],
};

const updateProduct = vi.fn(async () => PRODUCT);
const recordCount = vi.fn(async () => ({
  countId: 'c1', expectedOnHand: 94, countedOnHand: 80, variance: -14, onHand: 80,
}));
const setAllocations = vi.fn(async () => ({ allocated: [] }));

vi.mock('@/lib/api', () => ({
  PRODUCT_CATEGORIES: [{ value: 'beer', label: 'Beer' }],
  apiClient: {
    stock: {
      listProducts: vi.fn(async () => [PRODUCT, PRODUCT_OFF]),
      getAllocations: vi.fn(async () => ({ allocations: { p1: ['m1'], p2: ['m1'] } })),
      updateProduct: (...a: unknown[]) => updateProduct(...(a as [])),
      recordCount: (...a: unknown[]) => recordCount(...(a as [])),
      setAllocations: (...a: unknown[]) => setAllocations(...(a as [])),
    },
    merchants: { list: vi.fn(async () => [{ _id: 'm1', name: 'Main Bar' }]) },
    events: {
      getEventStockBoard: vi.fn(async () => BOARD),
      getEventStockMovements: vi.fn(async () => ({
        movements: [{
          id: 'mv1', at: '2026-09-05T10:00:00.000Z',
          merchantId: 'm1', merchantName: 'Main Bar',
          productId: 'p1', productName: 'Castle Lite 330ml',
          delta: 240, reason: 'receive', balanceAfter: 240,
          refType: null, refId: null,
          byType: 'Platform', by: 'menu-load', byName: null,
          note: 'Opening stock',
        }],
        nextCursor: null,
        hasMore: false,
      })),
    },
  },
}));

beforeEach(() => {
  updateProduct.mockClear();
  recordCount.mockClear();
  setAllocations.mockClear();
});

function renderPanel(url = '/events/e1?tab=cashless&sub=catalogue') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <EventCataloguePanel eventId="e1" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const CATALOGUE = '/events/e1?tab=cashless&sub=catalogue&view=catalogue';

describe('inline price editing on the catalogue list', () => {
  it('saves a new price from the row without opening the edit dialog', async () => {
    renderPanel(CATALOGUE);
    const row = (await screen.findByText('Castle Lite 330ml')).closest('tr')!;

    fireEvent.click(within(row).getByRole('button', { name: /Edit price/i }));

    const input = within(row).getByLabelText(/price/i) as HTMLInputElement;
    expect(input.value).toBe('25.00');

    fireEvent.change(input, { target: { value: '30.00' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(updateProduct).toHaveBeenCalledWith('p1', { price: 3000 }));
  });
});

describe('inline stock editing on the stock levels list', () => {
  it('books a typed total as a stock count for that stall', async () => {
    renderPanel();
    const row = (await screen.findByText('Castle Lite 330ml')).closest('tr')!;

    fireEvent.click(within(row).getByRole('button', { name: /Edit stock/i }));

    const input = within(row).getByLabelText(/on hand/i) as HTMLInputElement;
    // Pre-filled with the current count: this is a correction, not a delta.
    expect(input.value).toBe('94');

    fireEvent.change(input, { target: { value: '80' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(recordCount).toHaveBeenCalledWith('e1', {
      merchantId: 'm1', productId: 'p1', countedOnHand: 80,
    }));
  });

  it('writes nothing when the edit is abandoned with Escape', async () => {
    renderPanel();
    const row = (await screen.findByText('Castle Lite 330ml')).closest('tr')!;

    fireEvent.click(within(row).getByRole('button', { name: /Edit stock/i }));
    const input = within(row).getByLabelText(/on hand/i);
    fireEvent.change(input, { target: { value: '0' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(recordCount).not.toHaveBeenCalled();
  });
});

describe('a product switched off in the catalogue but still holding stock', () => {
  it('flags it on the stock levels list instead of showing it as ordinary stock', async () => {
    renderPanel();
    const row = (await screen.findByText('Old Cider')).closest('tr')!;
    expect(within(row).getByText(/inactive/i)).toBeDefined();
  });

  it('zeroes the count and takes it off every stall when zeroed out', async () => {
    renderPanel();
    const row = (await screen.findByText('Old Cider')).closest('tr')!;

    fireEvent.click(within(row).getByRole('button', { name: /Zero out/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Zero out and remove/i }));

    // The write-off goes through a count so the 40 units land in the journal
    // as a variance rather than vanishing.
    await waitFor(() => expect(recordCount).toHaveBeenCalledWith('e1', {
      merchantId: 'm1', productId: 'p2', countedOnHand: 0,
    }));
    await waitFor(() => expect(setAllocations).toHaveBeenCalledWith('e1', {
      productId: 'p2', merchantIds: [],
    }));
  });
});

describe('finding a row among many', () => {
  it('filters the stock levels list by product name', async () => {
    renderPanel();
    await screen.findByText('Old Cider');

    fireEvent.change(screen.getByPlaceholderText(/search products/i), {
      target: { value: 'cider' },
    });

    expect(screen.queryByText('Castle Lite 330ml')).toBeNull();
    expect(screen.getByText('Old Cider')).toBeDefined();
  });

  it('filters the catalogue list by product name', async () => {
    renderPanel(CATALOGUE);
    await screen.findByText('Old Cider');

    fireEvent.change(screen.getByPlaceholderText(/search products/i), {
      target: { value: 'castle' },
    });

    expect(screen.getByText('Castle Lite 330ml')).toBeDefined();
    expect(screen.queryByText('Old Cider')).toBeNull();
  });
});

describe('product detail', () => {
  it('opens a detail view with the stalls carrying it and its stock history', async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: /Details for Castle Lite 330ml/i }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Main Bar')).toBeDefined();
    // The audit trail: the journal already records every movement, so the
    // detail view surfaces it rather than storing anything new.
    expect(await within(dialog).findByText(/Opening stock/)).toBeDefined();
    expect(within(dialog).getByText('+240')).toBeDefined();
  });
});
