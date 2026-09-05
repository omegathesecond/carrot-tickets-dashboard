// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within, act } from '@testing-library/react';
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
    // M4: the test's own name claims a "clean save" was NOT reported — the
    // assertion above only checked that an error toast fired, which says
    // nothing about whether a success toast ALSO fired or the dialog closed
    // out from under the organizer as if nothing were wrong.
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
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

describe('unallocated products', () => {
  it('flags a product that no stall carries', async () => {
    getAllocations.mockResolvedValue({ allocations: { 'p-beer': [] } });
    renderPanel();

    expect(await screen.findByText(/not on any stall/i)).toBeTruthy();
  });

  it('does not flag a product that a stall carries', async () => {
    getAllocations.mockResolvedValue({ allocations: { 'p-beer': ['m-bar'] } });
    renderPanel();

    await screen.findByText('Castle Lite 330ml');
    expect(screen.queryByText(/not on any stall/i)).toBeNull();
  });

  it('allocates every product to every stall in one action', async () => {
    listProducts.mockResolvedValue([BEER, { ...BEER, _id: 'p-chicken', name: 'Quarter Chicken' }]);
    getAllocations.mockResolvedValue({ allocations: { 'p-beer': [], 'p-chicken': [] } });
    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: /allocate to all stalls/i }));

    await waitFor(() => expect(setAllocations).toHaveBeenCalledTimes(2));
    expect(setAllocations).toHaveBeenCalledWith('e1', { productId: 'p-beer', merchantIds: ['m-bar', 'm-shi'] });
    expect(setAllocations).toHaveBeenCalledWith('e1', { productId: 'p-chicken', merchantIds: ['m-bar', 'm-shi'] });
  });

  it('reports a partial failure rather than claiming every product was allocated', async () => {
    // Three products, rejecting the second: with only two products (the
    // original shape of this test) a Promise.all implementation and the
    // actual sequential-for design are indistinguishable — both would call
    // setAllocations twice and both would surface the same rejection. A
    // third product gives the loop something to skip, so this only passes
    // under a design that genuinely stops after the failure.
    listProducts.mockResolvedValue([
      BEER,
      { ...BEER, _id: 'p-chicken', name: 'Quarter Chicken' },
      { ...BEER, _id: 'p-chips', name: 'Boerewors Roll' },
    ]);
    getAllocations.mockResolvedValue({ allocations: { 'p-beer': [], 'p-chicken': [], 'p-chips': [] } });
    setAllocations
      .mockResolvedValueOnce({ allocated: ['m-bar', 'm-shi'] })
      .mockRejectedValueOnce(new Error('Cannot remove a stall that still holds stock: Bar (12)'));
    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: /allocate to all stalls/i }));

    // As in "surfaces an allocation failure instead of reporting a clean
    // save" above: sonner is mocked and no <Toaster/> is mounted in this
    // tree, so toast.error's message never reaches the DOM — assert the
    // mock call instead of hunting for rendered toast text.
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/still holds stock/i)),
    );
    // The third product's request must never fire once the second one has
    // already failed.
    expect(setAllocations).toHaveBeenCalledTimes(2);
  });

  it('offers no bulk action when the event has no stalls', async () => {
    listMerchants.mockResolvedValue([]);
    renderPanel();

    await screen.findByText('Castle Lite 330ml');
    expect(screen.queryByRole('button', { name: /allocate to all stalls/i })).toBeNull();
  });

  it('does not flag a product while the allocations fetch is still in flight (M2)', async () => {
    // The badge is this slice's only safety signal — rendering it on every
    // product while the query is still loading (before it has any evidence
    // either way) trains organizers to ignore it.
    let resolveAllocations!: (v: { allocations: Record<string, string[]> }) => void;
    getAllocations.mockReturnValue(new Promise((resolve) => { resolveAllocations = resolve; }));
    renderPanel();

    await screen.findByText('Castle Lite 330ml');
    expect(screen.queryByText(/not on any stall/i)).toBeNull();

    await act(async () => { resolveAllocations({ allocations: { 'p-beer': [] } }); });
    expect(await screen.findByText(/not on any stall/i)).toBeTruthy();
  });
});

// C1: a MANAGER (MANAGE_STOCK, no MANAGE_ACCESS) sees the Catalogue tab but
// the stalls list 403s — GET /api/tickets/merchants is gated on
// MANAGE_ACCESS, which ROLE_PERMISSIONS[MANAGER] omits. `stalls` then
// collapses to `[]`, which today is indistinguishable from an event that
// genuinely has no stalls.
describe('stalls could not be loaded (as distinct from genuinely having none)', () => {
  it('does not claim the event has no stalls, and does not report a clean save, when the stalls fetch fails', async () => {
    listMerchants.mockRejectedValue(new Error('Forbidden'));
    renderPanel();
    await openAdd();

    // Honest message: the event may already have stalls — a MANAGER who
    // cannot see the Stalls tab (gated on MANAGE_ACCESS) must not be told to
    // go create one there over a permissions/network hiccup that isn't a
    // setup problem at all.
    expect(await screen.findByText(/stalls could not be loaded/i)).toBeTruthy();
    expect(screen.queryByText(/create a stall first/i)).toBeNull();

    fireEvent.change(screen.getByPlaceholderText('Castle Lite 330ml'), { target: { value: 'Savanna Dry' } });
    fireEvent.change(screen.getByPlaceholderText('25.00'), { target: { value: '30.00' } });
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^add product$/i }));

    await waitFor(() => expect(createProduct).toHaveBeenCalled());
    // Allocation was skipped because we never learned the stall list — that
    // must never be reported as a clean, fully-applied save.
    expect(setAllocations).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/stalls could not be loaded/i));
  });
});

// C2: `openEdit` seeds `merchantIds` from the allocations query's own
// snapshot, and `submit` sends it as AUTHORITATIVE desired state to a
// destructive PUT. Nothing today gates on that query having actually
// succeeded — so a failed or still-loading allocations fetch turns any
// unrelated product edit (e.g. a price change) into a request to strip the
// product off every stall it is actually on.
describe('allocations could not be loaded (mass-delist guard)', () => {
  it('never sends merchantIds for an edit when the allocations fetch has failed', async () => {
    getAllocations.mockRejectedValue(new Error('network error'));
    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: /edit castle lite 330ml/i }));

    // Price-only edit — the stall checkboxes are never touched. openEdit
    // seeded them from `allocations['p-beer'] ?? []`, and with the fetch
    // failed that snapshot is `[]` regardless of what the product is
    // actually on (per this feature, every stall it's newly allocated to
    // sits at onHand: 0 — exactly what a real API deletes outright).
    fireEvent.change(screen.getByPlaceholderText('25.00'), { target: { value: '35.00' } });
    fireEvent.click(screen.getByRole('button', { name: /^save changes$/i }));

    await waitFor(() => expect(updateProduct).toHaveBeenCalled());
    expect(setAllocations).not.toHaveBeenCalled();
  });

  it('surfaces the allocations fetch failure as an error, not only through its side effects', async () => {
    getAllocations.mockRejectedValue(new Error('Could not reach the server'));
    renderPanel();

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Could not reach the server'));
  });
});
