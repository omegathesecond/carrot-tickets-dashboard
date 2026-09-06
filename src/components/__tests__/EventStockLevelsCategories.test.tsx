// @vitest-environment jsdom
//
// "under stock display categories, just like under catalogue" — 2026-09-06
//
// The Stock levels view lists every product at every stall. On a real event
// that is a couple of hundred rows across several stalls, and "show me the
// beers" is the question you arrive with. Same control as the Catalogue's, and
// literally the same component (CategoryFilterTabs) — a second copy is where
// the two would drift.
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup, within, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { EventCataloguePanel } from '@/components/cashless/EventCataloguePanel';

afterEach(cleanup);

const bar = (productId: string, productName: string, category: string, merchantName = 'Main Bar') => ({
  merchantId: merchantName === 'Main Bar' ? 'm1' : 'm2',
  merchantName,
  productId,
  productName,
  category,
  onHand: 12,
  unitsSold: 3,
  revenue: 9000,
  lowStockThreshold: null,
  status: 'in_stock',
});

const BOARD = {
  event: { id: 'e1', name: 'Sundeck Days' },
  perBar: [
    bar('p1', 'Castle Lite 330ml', 'beer'),
    bar('p2', 'Savanna Dry', 'cider'),
    bar('p3', 'Beef Bunny Chow', 'food', 'Grill'),
  ],
  byProduct: [],
};

vi.mock('@/lib/api', () => ({
  PRODUCT_CATEGORIES: [
    { value: 'beer', label: 'Beer' },
    { value: 'cider', label: 'Cider' },
    { value: 'food', label: 'Food' },
  ],
  apiClient: {
    stock: { listProducts: vi.fn(async () => []) },
    merchants: { list: vi.fn(async () => [{ _id: 'm1', name: 'Main Bar' }]) },
    events: { getEventStockBoard: vi.fn(async () => BOARD) },
  },
}));

function renderLevels() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/events/e1?tab=cashless&sub=catalogue']}>
        <EventCataloguePanel eventId="e1" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const stockTab = (name: RegExp) =>
  within(screen.getByRole('group', { name: 'Filter stock by category' }))
    .getByRole('button', { name });

describe('Stock levels filters by category', () => {
  it('offers a tab per category on the shelf, plus All', async () => {
    renderLevels();
    await screen.findByText('Castle Lite 330ml');

    expect(stockTab(/^All/).textContent).toContain('3');
    expect(stockTab(/^Beer/)).toBeTruthy();
    expect(stockTab(/^Cider/)).toBeTruthy();
    expect(stockTab(/^Food/)).toBeTruthy();
  });

  it('narrows the shelf to one category, across every stall', async () => {
    renderLevels();
    await screen.findByText('Castle Lite 330ml');

    fireEvent.click(stockTab(/^Food/));

    expect(screen.getByText('Beef Bunny Chow')).toBeTruthy();
    expect(screen.queryByText('Castle Lite 330ml')).toBeNull();
    expect(screen.queryByText('Savanna Dry')).toBeNull();
  });

  it('drops a stall entirely when it carries nothing in that category', async () => {
    renderLevels();
    await screen.findByText('Castle Lite 330ml');

    fireEvent.click(stockTab(/^Food/));

    // The Grill is the only stall with food; showing Main Bar with an empty
    // table under it would be worse than not showing it.
    expect(screen.getByText('Grill')).toBeTruthy();
    expect(screen.queryByText('Main Bar')).toBeNull();
  });

  it('says the filter emptied the shelf, not that no stock is loaded', async () => {
    renderLevels();
    await screen.findByText('Castle Lite 330ml');

    fireEvent.change(screen.getByPlaceholderText(/Search/i), { target: { value: 'zzz' } });

    // "No stock loaded yet. Use Receive…" would send an organizer to load
    // stock they already have.
    expect(screen.getByText(/No stock matches that filter/i)).toBeTruthy();
  });

  it('keeps its selection separate from the Catalogue\'s', async () => {
    renderLevels();
    await screen.findByText('Castle Lite 330ml');

    fireEvent.click(stockTab(/^Beer/));

    // Two lists answering different questions; a shared selection would
    // silently narrow one while you were filtering the other.
    const cat = screen.queryByRole('group', { name: 'Filter by category' });
    if (cat) {
      expect(within(cat).getByRole('button', { name: /^All/ }).getAttribute('aria-pressed')).toBe('true');
    }
    expect(stockTab(/^Beer/).getAttribute('aria-pressed')).toBe('true');
  });
});
