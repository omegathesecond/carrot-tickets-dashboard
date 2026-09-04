// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { EventCataloguePanel } from '@/components/cashless/EventCataloguePanel';
import { fmtR } from '@/lib/money';

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

// One product, stocked at one stall: 30 units rung up for R5 000,00, 94 left.
const BOARD = {
  event: { id: 'e1', name: 'Cashless Tap Test' },
  perBar: [{
    merchantId: 'm1',
    merchantName: 'Main Bar',
    productId: 'p1',
    productName: 'Castle Lite 330ml',
    category: 'beer',
    onHand: 94,
    unitsSold: 30,
    revenue: 500000,
    lowStockThreshold: null,
    status: 'in_stock',
  }],
  byProduct: [{
    productId: 'p1',
    productName: 'Castle Lite 330ml',
    category: 'beer',
    totalOnHand: 94,
    unitsSold: 30,
    revenue: 500000,
    status: 'in_stock',
  }],
};

vi.mock('@/lib/api', () => ({
  PRODUCT_CATEGORIES: [{ value: 'beer', label: 'Beer' }],
  apiClient: {
    stock: { listProducts: vi.fn(async () => [PRODUCT]) },
    merchants: { list: vi.fn(async () => [{ _id: 'm1', name: 'Main Bar' }]) },
    events: { getEventStockBoard: vi.fn(async () => BOARD) },
  },
}));

/**
 * en-ZA groups thousands with a non-breaking space, and testing-library
 * normalizes the element's text but not the string you match against — so
 * compare with every space stripped rather than hard-coding U+00A0.
 */
const money = (cents: number) => {
  const want = fmtR(cents).replace(/\s/g, '');
  return (content: string) => content.replace(/\s/g, '') === want;
};

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

describe('EventCataloguePanel', () => {
  it('splits the page into Stock levels and Catalogue tabs', () => {
    renderPanel();
    expect(screen.getByRole('tab', { name: 'Stock levels' })).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Catalogue' })).toBeDefined();
  });

  it('opens on Stock levels and shows what each product sold, took and has left', async () => {
    renderPanel();
    const row = (await screen.findByText('Castle Lite 330ml')).closest('tr')!;
    expect(within(row).getByText('30')).toBeDefined();
    expect(within(row).getByText('94')).toBeDefined();
    expect(within(row).getByText(money(500000))).toBeDefined();
  });

  it('rolls the board up into the page analytics', async () => {
    renderPanel();
    // Wait for the board itself: the tiles render at zero until it lands, so
    // asserting on a label alone would pass against an empty page.
    await screen.findByText('Main Bar');
    expect(screen.getByText('Units sold')).toBeDefined();
    expect(screen.getByText('On hand')).toBeDefined();
    expect(screen.getByText('Needs attention')).toBeDefined();
    // "Sales" is both a tile label and a column header, so reach the tile by
    // its hint — the value sits alongside it in the same card body.
    const salesTile = screen.getByText('what those units took').parentElement!;
    expect(within(salesTile).getByText(money(500000))).toBeDefined();
  });

  it('opens the Catalogue view when the URL asks for it', async () => {
    renderPanel('/events/e1?tab=cashless&sub=catalogue&view=catalogue');
    // The price list, not the shelf: barcode and pack size are catalogue-only.
    expect(await screen.findByText('6001240100015')).toBeDefined();
    expect(screen.getByText('24 / case')).toBeDefined();
    expect(screen.getByRole('button', { name: /Add product/ })).toBeDefined();
  });

  it('keeps the stock ops on the shelf view and off the price list', async () => {
    renderPanel();
    expect(await screen.findByRole('button', { name: 'Receive' })).toBeDefined();
    expect(screen.queryByRole('button', { name: /Add product/ })).toBeNull();
  });
});
