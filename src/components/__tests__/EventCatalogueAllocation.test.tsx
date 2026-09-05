// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';
import { EventCataloguePanel } from '@/components/cashless/EventCataloguePanel';

// Same approach as EventMenuTabCategory.test.tsx: no <Toaster/> is mounted
// in this tree, so toast.error's message never reaches the DOM — assert the
// mock call instead of hunting for rendered toast text.
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

const listProducts = vi.fn();
const createProduct = vi.fn();
const updateProduct = vi.fn();
const listMerchants = vi.fn();
const getEventStockBoard = vi.fn();
const getAllocations = vi.fn();
const setAllocations = vi.fn();

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    apiClient: {
      stock: {
        listProducts: (...a: unknown[]) => listProducts(...a),
        createProduct: (...a: unknown[]) => createProduct(...a),
        updateProduct: (...a: unknown[]) => updateProduct(...a),
        getAllocations: (...a: unknown[]) => getAllocations(...a),
        setAllocations: (...a: unknown[]) => setAllocations(...a),
      },
      merchants: { list: (...a: unknown[]) => listMerchants(...a) },
      events: { getEventStockBoard: (...a: unknown[]) => getEventStockBoard(...a) },
    },
  };
});

const BAR = { _id: 'm-bar', name: 'Bar', eventId: 'e1', commissionPercent: 0, status: 'active', createdAt: '' };
const SHI = { _id: 'm-shi', name: 'Shisanyama', eventId: 'e1', commissionPercent: 0, status: 'active', createdAt: '' };
const BEER = {
  _id: 'p-beer', name: 'Castle Lite 330ml', category: 'beer', price: 2500,
  barcode: null, imageUrl: null, unitLabel: 'unit', unitsPerPack: null, packLabel: null, active: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  listProducts.mockResolvedValue([BEER]);
  listMerchants.mockResolvedValue([BAR, SHI]);
  getEventStockBoard.mockResolvedValue({ rows: [] });
  getAllocations.mockResolvedValue({ allocations: { 'p-beer': ['m-bar'] } });
  createProduct.mockResolvedValue({ ...BEER, _id: 'p-new' });
  updateProduct.mockResolvedValue(BEER);
  setAllocations.mockResolvedValue({ allocated: [] });
});
afterEach(cleanup);

// EventCataloguePanel keeps which sub-view is showing in ?view=, and Radix
// unmounts an inactive TabsContent entirely — so without landing on the
// catalogue view up front, neither "Add product" nor the product rows (and
// their edit buttons) exist in the DOM yet. Every sibling test file
// (EventCataloguePanel.test.tsx, EventCatalogueImage.test.tsx) navigates
// with ?view=catalogue for this exact reason.
const renderPanel = () =>
  render(
    <MemoryRouter initialEntries={['/events/e1?view=catalogue']}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <EventCataloguePanel eventId="e1" />
      </QueryClientProvider>
    </MemoryRouter>,
  );

const openAdd = async () => {
  fireEvent.click(await screen.findByRole('button', { name: /add product/i }));
};

describe('stall allocation on the product dialog', () => {
  it('lists this event\'s stalls as checkboxes', async () => {
    renderPanel();
    await openAdd();

    expect(await screen.findByRole('checkbox', { name: 'Bar' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Shisanyama' })).toBeTruthy();
  });

  it('allocates a newly created product to the stalls that were ticked', async () => {
    renderPanel();
    await openAdd();

    fireEvent.change(await screen.findByPlaceholderText('Castle Lite 330ml'), { target: { value: 'Savanna Dry' } });
    fireEvent.change(screen.getByPlaceholderText('25.00'), { target: { value: '30.00' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Shisanyama' }));
    // The dialog's own submit button and the header's "Add product" trigger
    // share the exact same label (see EventCatalogueImage.test.tsx's
    // fillRequiredFieldsAndSubmit for the same scoping), so this must be
    // scoped to the dialog rather than matched on text alone.
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^add product$/i }));

    // The product must exist before it can be allocated, so the id used here
    // is the one the create call returned — not anything from the form.
    await waitFor(() => expect(setAllocations).toHaveBeenCalledWith('e1', {
      productId: 'p-new',
      merchantIds: ['m-shi'],
    }));
  });

  it('prefills an existing product\'s current stalls when editing', async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: /edit castle lite 330ml/i }));

    // The shadcn/Radix Checkbox renders a <button role="checkbox"> with
    // aria-checked/data-state, not a native <input> — there is no .checked
    // DOM property to read here.
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Bar' }).getAttribute('aria-checked')).toBe('true'));
    expect(screen.getByRole('checkbox', { name: 'Shisanyama' }).getAttribute('aria-checked')).toBe('false');
  });

  it('sends the full desired set when an edit changes the stalls', async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: /edit castle lite 330ml/i }));
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Shisanyama' }));
    fireEvent.click(screen.getByRole('button', { name: /^save changes$/i }));

    await waitFor(() => expect(setAllocations).toHaveBeenCalledWith('e1', {
      productId: 'p-beer',
      merchantIds: ['m-bar', 'm-shi'],
    }));
  });

  it('surfaces an allocation failure instead of reporting a clean save', async () => {
    setAllocations.mockRejectedValue(new Error('Cannot remove a stall that still holds stock: Bar (12)'));
    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: /edit castle lite 330ml/i }));
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Bar' }));
    fireEvent.click(screen.getByRole('button', { name: /^save changes$/i }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/still holds stock/i)),
    );
  });

  it('points at the Stalls tab when the event has none, and still saves the product', async () => {
    listMerchants.mockResolvedValue([]);
    renderPanel();
    await openAdd();

    expect(await screen.findByText(/create a stall first/i)).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText('Castle Lite 330ml'), { target: { value: 'Savanna Dry' } });
    fireEvent.change(screen.getByPlaceholderText('25.00'), { target: { value: '30.00' } });
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^add product$/i }));

    await waitFor(() => expect(createProduct).toHaveBeenCalled());
    // Nothing to allocate to — but the product is saved, and Task 3's flag is
    // what makes its invisibility on the POS obvious.
    expect(setAllocations).not.toHaveBeenCalled();
  });
});
