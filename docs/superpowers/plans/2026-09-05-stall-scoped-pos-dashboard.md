# Stall-Scoped POS — Dashboard Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the organizer say which stalls carry each product, make a product that no stall carries impossible to miss, and rename the cashless tab's Money trigger to Transactions.

**Architecture:** The catalogue panel already loads this event's stalls (`apiClient.merchants.list`, `EventCataloguePanel.tsx:99`), so the allocation control needs no new fetch. Allocations are read once for the whole event and written per product through the API slice's `stock/allocations` endpoints.

**Tech Stack:** React 19, TypeScript, TanStack Query, shadcn/ui (Radix), Vitest + Testing Library + jsdom.

**Spec:** `../api-stockgrant-wt/docs/superpowers/specs/2026-09-05-stall-scoped-pos-and-hardware-scanning-design.md`

**Worktree:** `carrot-tickets/dashboard-stockgrant-wt`, branch `feat/stall-scoped-dashboard` (branched from `origin/main` @ `8d862f1`).

## Global Constraints

- **This slice depends on the API slice being deployed.** `GET`/`PUT /api/tickets/events/:eventId/stock/allocations` must exist or every allocation call 404s.
- **No silent fallbacks.** A failed allocation surfaces through the existing `toast.error` path. Never leave a save looking successful when part of it failed.
- **Never rename `value="money"`.** It is the `?sub=` URL key in `EventCashlessTab.tsx`; only the visible label changes.
- **Follow the file's existing idioms:** `useMutation` + `queryClient.invalidateQueries`, `toast.success`/`toast.error`, and `setForm((f) => ({ ...f, … }))` — the functional updater, because this file has already had a stale-closure bug in an async completion path.
- **Money is integer cents** (`randToCents`). Never floats.
- **Tests:** `npx vitest run <path>`. Baseline is 49 files / 335 tests green.
- **Never `git add -A`.** `node_modules` here is a shared symlink. Stage named paths only. Never run `git clean`, or `git stash -u`.

---

### Task 1: The cashless tab's Money trigger reads Transactions

**Files:**
- Modify: `src/components/EventCashlessTab.tsx:185` (the trigger label), plus the file's doc comment at lines 36-40
- Test: `src/components/__tests__/EventCashlessTabLabel.test.tsx` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing other tasks depend on.

"Money" names the subject; the pane is the organizer's transaction report. The tab's `value` stays `"money"` because it is the `?sub=` deep-link key — renaming it would break every existing shared link for a cosmetic gain, and the file already carries fallback logic keyed on that string (`EventCashlessTab.tsx:72-82`).

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/EventCashlessTabLabel.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { EventCashlessTab } from '@/components/EventCashlessTab';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    apiClient: {
      events: { getEventCashlessSummary: vi.fn().mockResolvedValue({}) },
    },
  };
});

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { isSuperAdmin: true, permissions: [] } }),
}));

afterEach(cleanup);

const renderTab = (initialEntry = '/events/e1') =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <EventCashlessTab eventId="e1" />
      </QueryClientProvider>
    </MemoryRouter>,
  );

describe('cashless tab labels', () => {
  it('labels the transaction report Transactions, not Money', () => {
    renderTab();
    expect(screen.getByRole('tab', { name: 'Transactions' })).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'Money' })).toBeNull();
  });

  it('still selects that tab from an existing ?sub=money deep link', () => {
    renderTab('/events/e1?sub=money');
    // The URL key is unchanged — only the label moved. An organizer's saved
    // link must keep landing on the same pane.
    expect(screen.getByRole('tab', { name: 'Transactions' }).getAttribute('data-state')).toBe('active');
  });
});
```

If `useAuth` lives at a different path, follow the import in `EventCashlessTab.tsx` and mock that path instead.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/__tests__/EventCashlessTabLabel.test.tsx`
Expected: the first FAILS — `Unable to find an accessible element with the role "tab" and name "Transactions"`.

- [ ] **Step 3: Rename the label**

In `src/components/EventCashlessTab.tsx:185`, change:

```tsx
        <TabsTrigger value="money">Money</TabsTrigger>
```

to:

```tsx
        {/* value stays "money": it is the ?sub= deep-link key and the fallback
            target above. Only the label changed. */}
        <TabsTrigger value="money">Transactions</TabsTrigger>
```

In the file's doc comment (lines 36-40), replace the two uses of "Money" as a proper noun so the comment stops naming a tab that no longer exists:

```
 * Everything cashless for ONE event. Transactions is the organizer's
 * transaction report; Register, Stalls, Catalogue, Cashiers and Balances each
 * manage the people, products and tags behind it, and each carries its own
 * breakdown (activity, takings, stock) as a nested tab rather than dumping
 * every breakdown under Transactions regardless of which desk it is about.
```

Leave the comments at lines 72-82 alone — they describe the `'money'` *value*, which is still accurate.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/__tests__/EventCashlessTabLabel.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 5: Check no other test asserted the old label**

Run: `npx vitest run` and also `grep -rn "'Money'\|\"Money\"" src/ --include=*.tsx --include=*.ts`

Expected: full suite green. Any test asserting the tab name `Money` must be updated to `Transactions` — note it in your report.

- [ ] **Step 6: Commit**

```bash
git add src/components/EventCashlessTab.tsx src/components/__tests__/EventCashlessTabLabel.test.tsx
git commit -m "feat(cashless): call the transaction report Transactions, not Money"
```

---

### Task 2: Choose which stalls carry a product

**Files:**
- Modify: `src/lib/api.ts` (add two methods to the `stock` namespace, after `receive` ~line 1372)
- Modify: `src/components/cashless/EventCataloguePanel.tsx` (form type, dialog body, submit path)
- Test: `src/components/__tests__/EventCatalogueAllocation.test.tsx` (create)

**Interfaces:**
- Consumes: the API slice's endpoints —
  - `GET /tickets/events/:eventId/stock/allocations` → `{ allocations: Record<string, string[]> }` (productId → merchantIds; every product is a key, `[]` when none)
  - `PUT /tickets/events/:eventId/stock/allocations` body `{ productId, merchantIds }` → `{ allocated: string[] }`
- Produces: `apiClient.stock.getAllocations(eventId)` and `apiClient.stock.setAllocations(eventId, { productId, merchantIds })`, used again by Task 3.

The panel already has the stall list — `const { data: stalls = [] } = useQuery(… apiClient.merchants.list(eventId))` at line 99. A product must exist before it can be allocated, so on create the allocation call follows the create call.

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/EventCatalogueAllocation.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { EventCataloguePanel } from '@/components/cashless/EventCataloguePanel';

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

const renderPanel = () =>
  render(
    <MemoryRouter>
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
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

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

    await waitFor(() => expect((screen.getByRole('checkbox', { name: 'Bar' }) as HTMLInputElement).checked).toBe(true));
    expect((screen.getByRole('checkbox', { name: 'Shisanyama' }) as HTMLInputElement).checked).toBe(false);
  });

  it('sends the full desired set when an edit changes the stalls', async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: /edit castle lite 330ml/i }));
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Shisanyama' }));
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

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
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(await screen.findByText(/still holds stock/i)).toBeTruthy();
  });

  it('points at the Stalls tab when the event has none, and still saves the product', async () => {
    listMerchants.mockResolvedValue([]);
    renderPanel();
    await openAdd();

    expect(await screen.findByText(/create a stall first/i)).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText('Castle Lite 330ml'), { target: { value: 'Savanna Dry' } });
    fireEvent.change(screen.getByPlaceholderText('25.00'), { target: { value: '30.00' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(createProduct).toHaveBeenCalled());
    // Nothing to allocate to — but the product is saved, and Task 3's flag is
    // what makes its invisibility on the POS obvious.
    expect(setAllocations).not.toHaveBeenCalled();
  });
});
```

**The edit button has no accessible name today** — the product row renders `<Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>` (~line 392), an icon with no label, which is a real accessibility defect as well as untestable. Giving it one is part of this task, not a workaround for the test:

```tsx
<Button variant="ghost" size="icon" aria-label={`Edit ${p.name}`} onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/__tests__/EventCatalogueAllocation.test.tsx`
Expected: FAIL — no checkboxes render; `getAllocations`/`setAllocations` do not exist on `apiClient.stock`.

- [ ] **Step 3: Add the API client methods**

In `src/lib/api.ts`, inside the `stock = { … }` namespace after `receive`:

```ts
    /** productId → the stalls that carry it. Every product at the event is a
     *  key; a product no stall carries maps to an empty array. */
    getAllocations: async (eventId: string): Promise<{ allocations: Record<string, string[]> }> =>
      this.request<{ allocations: Record<string, string[]> }>(
        `/tickets/events/${eventId}/stock/allocations`,
      ),

    setAllocations: async (
      eventId: string,
      data: { productId: string; merchantIds: string[] },
    ): Promise<{ allocated: string[] }> =>
      this.request<{ allocated: string[] }>(`/tickets/events/${eventId}/stock/allocations`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
```

- [ ] **Step 4: Add the allocation control and wire the submit path**

In `src/components/cashless/EventCataloguePanel.tsx`:

1. Import the checkbox: `import { Checkbox } from '@/components/ui/checkbox';`

2. Add `merchantIds: string[]` to `ProductForm` (line 36) and `merchantIds: []` to `EMPTY_FORM` (line 47).

3. Add the allocations query beside the existing ones (after the `stalls` query at line 99-103):

```tsx
  const { data: allocationData } = useQuery({
    queryKey: ['event-stock-allocations', eventId],
    queryFn: () => apiClient.stock.getAllocations(eventId),
  });
  const allocations = allocationData?.allocations ?? {};
```

4. In the edit prefill (`openEdit`, ~line 208), add `merchantIds: allocations[p._id] ?? []` to the `setForm({ … })` object.

5. In the dialog body, directly beneath the Category field, add:

```tsx
            <div className="space-y-1">
              <Label>Sold at</Label>
              {stalls.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Create a stall first on the Stalls tab — a product with no stall
                  does not appear on any handheld.
                </p>
              ) : (
                <div className="space-y-2 rounded-lg border p-3">
                  {stalls.map((s) => (
                    <div key={s._id} className="flex items-center gap-2">
                      <Checkbox
                        id={`stall-${s._id}`}
                        checked={form.merchantIds.includes(s._id)}
                        onCheckedChange={(on) =>
                          setForm((f) => ({
                            ...f,
                            merchantIds: on
                              ? [...new Set([...f.merchantIds, s._id])]
                              : f.merchantIds.filter((id) => id !== s._id),
                          }))
                        }
                      />
                      <Label htmlFor={`stall-${s._id}`} className="font-normal">{s.name}</Label>
                    </div>
                  ))}
                </div>
              )}
            </div>
```

6. Change the `saveProduct` mutation (line 142) so the allocation write follows the product write and its failure is not swallowed:

```tsx
  const saveProduct = useMutation({
    mutationFn: async (payload: { create?: NewProduct; update?: UpdateProduct; merchantIds: string[] }) => {
      const saved = editing
        ? await apiClient.stock.updateProduct(editing._id, payload.update!)
        : await apiClient.stock.createProduct(eventId, payload.create!);
      // A product must exist before it can be allocated, so this follows the
      // save rather than running alongside it. A failure here propagates — a
      // half-applied save must never report success.
      if (stalls.length) {
        await apiClient.stock.setAllocations(eventId, {
          productId: saved._id,
          merchantIds: payload.merchantIds,
        });
      }
      return saved;
    },
```

Keep the mutation's existing `onSuccess`/`onError` handlers, and add `queryClient.invalidateQueries({ queryKey: ['event-stock-allocations', eventId] })` alongside the existing invalidation in `onSuccess`.

7. In `submit`, pass `merchantIds: form.merchantIds` in both the `editing` and create branches of `saveProduct.mutate({ … })`. Do not otherwise change the payloads.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/components/__tests__/EventCatalogueAllocation.test.tsx`
Expected: PASS, 6 tests.

- [ ] **Step 6: Run the existing catalogue tests**

Run: `npx vitest run src/components/__tests__/EventCatalogue`
Expected: PASS. The dialog gained a field; no existing assertion should move. If one broke because it counted dialog fields, fix the count and note it.

- [ ] **Step 7: Commit**

```bash
git add src/lib/api.ts src/components/cashless/EventCataloguePanel.tsx src/components/__tests__/EventCatalogueAllocation.test.tsx
git commit -m "feat(catalogue): choose which stalls carry a product"
```

---

### Task 3: A product on no stall is flagged, and can be put on all of them in one click

**Files:**
- Modify: `src/components/cashless/EventCataloguePanel.tsx` (the product table row ~line 380, and a header action)
- Test: `src/components/__tests__/EventCatalogueAllocation.test.tsx` (append)

**Interfaces:**
- Consumes: `allocations` from Task 2's query, and `apiClient.stock.setAllocations`.
- Produces: nothing later tasks depend on.

This is the safety net for the deliberate decision not to backfill. A product allocated to nobody is invisible on every handheld; without a visible flag the organizer's only symptom is an empty POS at the bar. "Allocate to all stalls" is what makes restoring the whole catalogue after deploy a few clicks rather than a per-product pass.

- [ ] **Step 1: Write the failing test**

Append to `src/components/__tests__/EventCatalogueAllocation.test.tsx`:

```tsx
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
    listProducts.mockResolvedValue([BEER, { ...BEER, _id: 'p-chicken', name: 'Quarter Chicken' }]);
    getAllocations.mockResolvedValue({ allocations: { 'p-beer': [], 'p-chicken': [] } });
    setAllocations
      .mockResolvedValueOnce({ allocated: ['m-bar', 'm-shi'] })
      .mockRejectedValueOnce(new Error('Cannot remove a stall that still holds stock: Bar (12)'));
    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: /allocate to all stalls/i }));

    expect(await screen.findByText(/still holds stock/i)).toBeTruthy();
  });

  it('offers no bulk action when the event has no stalls', async () => {
    listMerchants.mockResolvedValue([]);
    renderPanel();

    await screen.findByText('Castle Lite 330ml');
    expect(screen.queryByRole('button', { name: /allocate to all stalls/i })).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/__tests__/EventCatalogueAllocation.test.tsx -t "unallocated"`
Expected: FAIL — neither the flag nor the button exists.

- [ ] **Step 3: Add the flag to the product row**

In the products table body (~line 380), inside the cell that renders the product name, after the name:

```tsx
                          {(allocations[p._id]?.length ?? 0) === 0 && (
                            <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">
                              Not on any stall
                            </span>
                          )}
```

- [ ] **Step 4: Add the bulk action**

Add the mutation beside the others:

```tsx
  const allocateAll = useMutation({
    mutationFn: async () => {
      const merchantIds = stalls.map((s) => s._id);
      // Sequential, not Promise.all: the first failure stops the run and is
      // reported, rather than firing every request and surfacing one rejection
      // out of many with no idea which products actually landed.
      for (const p of products) {
        await apiClient.stock.setAllocations(eventId, { productId: p._id, merchantIds });
      }
    },
    onSuccess: () => {
      toast.success('Every product is now on every stall');
      queryClient.invalidateQueries({ queryKey: ['event-stock-allocations', eventId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
```

And render the trigger in the catalogue header, beside the Add product button:

```tsx
              {stalls.length > 0 && (
                <Button
                  variant="outline"
                  disabled={allocateAll.isPending}
                  onClick={() => allocateAll.mutate()}
                >
                  {allocateAll.isPending ? 'Allocating…' : 'Allocate to all stalls'}
                </Button>
              )}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/components/__tests__/EventCatalogueAllocation.test.tsx`
Expected: PASS, 11 tests.

- [ ] **Step 6: Commit**

```bash
git add src/components/cashless/EventCataloguePanel.tsx src/components/__tests__/EventCatalogueAllocation.test.tsx
git commit -m "feat(catalogue): flag products on no stall and allocate all in one click"
```

---

## Verification before handing off

- [ ] `npx tsc --noEmit` clean.
- [ ] `npm run build` clean.
- [ ] `npx vitest run` — full suite green (baseline 49 files / 335 tests, plus this slice's 2 new files).
- [ ] `npx eslint` on every changed file introduces **zero** new errors. `src/lib/api.ts` has 4 pre-existing errors at lines 68/151/163/238 — those are not yours.
- [ ] Click through on dev-manage: the tab reads Transactions, `?sub=money` still lands on it, a new product can be ticked onto a stall, and a product on no stall shows the amber flag.
