// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { EventMenuTab } from '@/components/EventMenuTab';
import type { MenuItemRow, MenuSection } from '@/lib/api';

// Radix Select needs two things jsdom doesn't ship: ResizeObserver (its popper
// positioning measures the trigger/content) and scrollIntoView (called on the
// selected item once the content opens). Same shape as the ResizeObserver
// polyfill in StallOperatorsPanel.test.tsx.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
if (typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = () => {};
}

const listItems = vi.fn();
const createItem = vi.fn();
const updateItem = vi.fn();
const deleteItem = vi.fn();
const listOrders = vi.fn();
const updateOrderFulfillment = vi.fn();
const listMerchants = vi.fn();
const listProducts = vi.fn();

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    apiClient: {
      menu: {
        listItems: (...a: unknown[]) => listItems(...a),
        // Drops eventId before recording the call — these tests only care
        // what payload the form built, not which event it's for.
        createItem: (_eventId: string, data: unknown) => createItem(data),
        updateItem: (...a: unknown[]) => updateItem(...a),
        deleteItem: (...a: unknown[]) => deleteItem(...a),
        listOrders: (...a: unknown[]) => listOrders(...a),
        updateOrderFulfillment: (...a: unknown[]) => updateOrderFulfillment(...a),
      },
      merchants: { list: (...a: unknown[]) => listMerchants(...a) },
      stock: { listProducts: (...a: unknown[]) => listProducts(...a) },
    },
  };
});

beforeEach(() => {
  createItem.mockResolvedValue({ _id: 'new-item' });
  updateItem.mockResolvedValue({});
  deleteItem.mockResolvedValue({ deleted: true });
  listOrders.mockResolvedValue([]);
  updateOrderFulfillment.mockResolvedValue({});
  listMerchants.mockResolvedValue([]);
  listProducts.mockResolvedValue([]);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

let nextId = 0;
type SeedItem = { category: string; section: MenuSection; name: string };
const buildMenuItem = (seed: SeedItem): MenuItemRow => ({
  _id: `item-${++nextId}`,
  eventId: 'e1',
  section: seed.section,
  vendorName: seed.section === 'vendor' ? 'Test Vendor' : null,
  category: seed.category,
  name: seed.name,
  description: null,
  price: 1000,
  imageUrl: null,
  active: true,
  displayOrder: 0,
  createdAt: '2026-09-05T00:00:00.000Z',
  updatedAt: '2026-09-05T00:00:00.000Z',
});

/**
 * Renders EventMenuTab with the menu-items query resolving to `seeds`, and
 * waits for the first item's name so the list — and the categoryOptions memo
 * derived from it — has settled before a test interacts with anything.
 */
const renderMenuTabWithItems = async (seeds: SeedItem[]) => {
  listItems.mockResolvedValue(seeds.map(buildMenuItem));
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <EventMenuTab eventId="e1" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await screen.findByText(seeds[0].name);
};

/** Clicks the header's add-item trigger and waits for the dialog to mount. */
const openAddItemDialog = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Add menu item' }));
  return screen.findByRole('dialog');
};

/**
 * Fills the two fields every submit needs regardless of category (name,
 * price) and submits — scoped to the dialog, since the header's "Add menu
 * item" trigger and the dialog's own "Add item" submit button both start
 * with "Add" and an unscoped query could match either.
 */
const fillRequiredFieldsAndSubmit = async () => {
  const dialog = screen.getByRole('dialog');
  fireEvent.change(within(dialog).getByPlaceholderText('Stoney Ginger Beer 300ml'), {
    target: { value: 'Test Item' },
  });
  fireEvent.change(within(dialog).getByPlaceholderText('25.00'), { target: { value: '10.00' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Add item' }));
};

describe('EventMenuTab category picker', () => {
  // The point of this change is discoverability: the old control was an
  // <Input list=…> datalist, which looks identical to a plain text box, so
  // nobody found the suggestions and menus grew "Drinks" next to "drinks".
  it('offers the categories already used on this event', async () => {
    await renderMenuTabWithItems([
      { category: 'Starters', section: 'vendor', name: 'Wings' },
      { category: 'Mains', section: 'vendor', name: 'Burger' },
    ]);
    await openAddItemDialog();

    fireEvent.click(await screen.findByRole('combobox', { name: /category/i }));

    expect(await screen.findByRole('option', { name: 'Starters' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Mains' })).toBeTruthy();
  });

  it('lets a new category be created inline, and saves what was typed', async () => {
    await renderMenuTabWithItems([{ category: 'Starters', section: 'vendor', name: 'Wings' }]);
    await openAddItemDialog();

    fireEvent.click(await screen.findByRole('combobox', { name: /category/i }));
    fireEvent.click(await screen.findByRole('option', { name: /new category/i }));

    const input = await screen.findByPlaceholderText(/cold drinks/i);
    fireEvent.change(input, { target: { value: 'Braai Platters' } });
    await fillRequiredFieldsAndSubmit();

    await waitFor(() =>
      expect(createItem).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'Braai Platters' }),
      ),
    );
  });

  it('saves an existing category without inventing a new one', async () => {
    await renderMenuTabWithItems([{ category: 'Starters', section: 'vendor', name: 'Wings' }]);
    await openAddItemDialog();

    fireEvent.click(await screen.findByRole('combobox', { name: /category/i }));
    fireEvent.click(await screen.findByRole('option', { name: 'Starters' }));
    await fillRequiredFieldsAndSubmit();

    await waitFor(() =>
      expect(createItem).toHaveBeenCalledWith(expect.objectContaining({ category: 'Starters' })),
    );
  });
});
