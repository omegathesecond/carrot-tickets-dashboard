// @vitest-environment jsdom
//
// "On the Catalogue, stock level categories tabs please also display the stock
// like you have displayed under MENU. This is very neat and easy to
// maneuver." — 2026-09-06
//
// The Menu tab groups its items under category headings, which is what makes
// a long list navigable. The Catalogue was one flat table with a Category
// column: to find the beers you read every row. It also showed price, barcode
// and pack size but never how many were left, so answering "what do we have?"
// meant switching to Stock levels and back.
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup, within, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { EventCataloguePanel } from '@/components/cashless/EventCataloguePanel';

afterEach(cleanup);

const product = (over: Record<string, unknown>) => ({
  _id: 'p1',
  name: 'Castle Lite 330ml',
  category: 'beer',
  price: 2500,
  barcode: null,
  unitLabel: 'unit',
  unitsPerPack: null,
  packLabel: null,
  active: true,
  ...over,
});

const PRODUCTS = [
  product({}),
  product({ _id: 'p2', name: 'Savanna Dry', category: 'cider' }),
  product({ _id: 'p3', name: 'Beef Bunny Chow', category: 'food' }),
  // Deliberately absent from BOARD.byProduct: never stocked anywhere.
  product({ _id: 'p4', name: 'Never Stocked', category: 'food' }),
];

const byProduct = (productId: string, totalOnHand: number, status: string) => ({
  productId,
  productName: '',
  category: '',
  totalOnHand,
  unitsSold: 0,
  revenue: 0,
  status,
});

const BOARD = {
  event: { id: 'e1', name: 'Sundeck Days' },
  perBar: [],
  byProduct: [
    byProduct('p1', 94, 'in_stock'),
    byProduct('p2', 3, 'low'),
    byProduct('p3', 0, 'sold_out'),
  ],
};

vi.mock('@/lib/api', () => ({
  PRODUCT_CATEGORIES: [
    { value: 'beer', label: 'Beer' },
    { value: 'cider', label: 'Cider' },
    { value: 'food', label: 'Food' },
  ],
  apiClient: {
    stock: { listProducts: vi.fn(async () => PRODUCTS) },
    merchants: { list: vi.fn(async () => [{ _id: 'm1', name: 'Main Bar' }]) },
    events: { getEventStockBoard: vi.fn(async () => BOARD) },
  },
}));

function renderCatalogue() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter
        initialEntries={['/events/e1?tab=cashless&sub=catalogue&view=catalogue']}
      >
        <EventCataloguePanel eventId="e1" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const categoryTab = (name: RegExp) =>
  within(screen.getByRole('group', { name: 'Filter by category' }))
    .getByRole('button', { name });

describe('the Catalogue groups by category', () => {
  it('offers a tab per category in use, plus All', async () => {
    renderCatalogue();
    await screen.findByText('Castle Lite 330ml');

    expect(categoryTab(/^All/)).toBeDefined();
    expect(categoryTab(/^Beer/)).toBeDefined();
    expect(categoryTab(/^Cider/)).toBeDefined();
    expect(categoryTab(/^Food/)).toBeDefined();
    expect(categoryTab(/^Food/).textContent).toContain('2');
  });

  it('counts what is in each category, so an empty one is obvious before you tap it', async () => {
    renderCatalogue();
    await screen.findByText('Castle Lite 330ml');

    expect(categoryTab(/^All/).textContent).toContain('4');
    expect(categoryTab(/^Beer/).textContent).toContain('1');
  });

  it('shows every product until a category is chosen', async () => {
    renderCatalogue();
    await screen.findByText('Castle Lite 330ml');

    expect(screen.getByText('Savanna Dry')).toBeDefined();
    expect(screen.getByText('Beef Bunny Chow')).toBeDefined();
  });

  it('narrows to one category on tap, and All brings the rest back', async () => {
    renderCatalogue();
    await screen.findByText('Castle Lite 330ml');

    fireEvent.click(categoryTab(/^Beer/));

    expect(screen.getByText('Castle Lite 330ml')).toBeDefined();
    expect(screen.queryByText('Savanna Dry')).toBeNull();
    expect(screen.queryByText('Beef Bunny Chow')).toBeNull();

    fireEvent.click(categoryTab(/^All/));

    expect(screen.getByText('Savanna Dry')).toBeDefined();
  });

  it('says so when a category and a search agree on nothing', async () => {
    renderCatalogue();
    await screen.findByText('Castle Lite 330ml');

    fireEvent.change(screen.getByPlaceholderText(/Search/i), {
      target: { value: 'savanna' },
    });
    fireEvent.click(categoryTab(/^Beer/));

    // Both filters are live at once, so an empty table needs to say why
    // rather than look like a catalogue with nothing in it.
    expect(screen.getByText(/No products in that category/i)).toBeDefined();
  });
});

describe('the Catalogue shows the shelf', () => {
  it('carries on-hand for each product', async () => {
    renderCatalogue();
    await screen.findByText('Castle Lite 330ml');

    // Answering "how many left?" used to mean switching to Stock levels and
    // back for every product.
    expect(
      screen.getByLabelText('On hand for Castle Lite 330ml').textContent,
    ).toBe('94');
  });

  it('flags low and sold-out rather than just printing a number', async () => {
    renderCatalogue();
    await screen.findByText('Castle Lite 330ml');

    const low = screen.getByText('Savanna Dry').closest('tr')!;
    expect(within(low).getByText(/Low/i)).toBeDefined();

    const gone = screen.getByText('Beef Bunny Chow').closest('tr')!;
    expect(within(gone).getByText(/Sold out/i)).toBeDefined();
  });

  it('reads a sold-out product differently from one never stocked', async () => {
    renderCatalogue();
    await screen.findByText('Castle Lite 330ml');

    // Both have nothing on the shelf; only one of them was ever ordered, and
    // an organizer deciding what to buy needs to tell them apart.
    expect(screen.getByLabelText('On hand for Beef Bunny Chow').textContent)
      .toMatch(/Sold out/i);
    expect(screen.getByLabelText('On hand for Never Stocked').textContent)
      .toBe('—');
  });
});
