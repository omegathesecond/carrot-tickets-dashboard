# Stock grant — dashboard implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an organizer switch `manage_stock` on for a stall operator, and show who moved stock in the movements log.

**Architecture:** The API already accepts and returns `grants` on stall operators and returns `byName` on movement rows; nothing here needs a backend change. Three pieces: teach the shared `OperatorGrantsField` which grants apply to which population (it currently renders every grant everywhere, which becomes wrong the moment a second grant exists), add the field to `StallOperatorsPanel`, and add a "Who" column to the movements table.

**Tech Stack:** React 19 + TypeScript, TanStack Query, shadcn/ui, Tailwind, Vitest + Testing Library (jsdom).

**Spec:** `../api-stockgrant-wt/docs/superpowers/specs/2026-09-05-merchant-stock-controller-grant-design.md` §5

## Correction to the spec

The spec says the dashboard needs to render `byName ?? by`. It does not — **the movements table has no actor column at all today**. `MovementsSection` in `EventStockReport.tsx` renders When / Stall / Product / Reason / Δ / After. This plan therefore *adds* a Who column rather than changing an existing one.

Two other things the spec implies are already done, verified on `origin/main`: `REASON_CLASS` already styles `spoilage` (`EventStockReport.tsx:325`), so the newly-populated spoilage rows render correctly with no change; and the stock report already renders board, dashboard, reconciliation and a paginated movements log.

## Global Constraints

- **`appliesTo` must land in the same change as the second grant's UI.** Without it, stall staff are offered `issue_tags` and gate operators are offered `manage_stock` — both inert. A switch that does nothing is worse than a missing switch.
- **Never invent a grant list client-side per surface.** One catalogue in `src/lib/api.ts` remains the single source of truth; each surface filters it, and no surface hardcodes grant strings.
- **Absent means unchanged.** A PATCH that edits a name must not send `grants` and must not clear them — mirror how `isActive` is sent today.
- **No silent fallbacks.** A failed grant mutation surfaces via `toast.error` with the API's own message, matching the panel's existing mutations.
- Run tests with `npx vitest run <path>` from the worktree root. Full suite: `npm test`.
- Work in a worktree off `origin/main`. `node_modules` is a symlink to the shared install in `dashboard/` — never `git clean -xfd` or `git stash push -u` here.

---

### Task 1: Teach the grant catalogue which population each grant belongs to

**Files:**
- Modify: `src/lib/api.ts:1745-1752` (`OperatorGrant`, `OPERATOR_GRANT_LABELS`)
- Modify: `src/components/OperatorGrantsField.tsx`
- Modify: `src/components/CashiersPanel.tsx:116`, `src/pages/GateOperatorsPage.tsx:226` and `:335` (the three existing call sites)
- Test: `src/components/__tests__/OperatorGrantsField.test.tsx` (extend)

**Interfaces:**
- Produces: `OperatorGrant = 'issue_tags' | 'manage_stock'`; each entry in `OPERATOR_GRANT_LABELS` gains `appliesTo: OperatorPopulation[]` where `OperatorPopulation = 'gate' | 'cashier' | 'merchant'`; `<OperatorGrantsField population="gate" … />` renders only that population's grants.

- [ ] **Step 1: Write the failing test**

Extend `src/components/__tests__/OperatorGrantsField.test.tsx`. Keep its existing four tests; they must keep passing with `population="gate"` added to `renderField`:

```ts
const renderField = (value: OperatorGrant[] = [], population: OperatorPopulation = 'gate') => {
  const onChange = vi.fn();
  render(<OperatorGrantsField population={population} value={value} onChange={onChange} />);
  return { onChange };
};

describe('population filtering', () => {
  it('offers a gate operator the tag desk but not stock', () => {
    renderField([], 'gate');
    expect(screen.getByRole('switch', { name: /works the register desk/i })).toBeTruthy();
    expect(screen.queryByRole('switch', { name: /stock/i })).toBeNull();
  });

  it('offers a stall operator stock but not the tag desk', () => {
    renderField([], 'merchant');
    expect(screen.getByRole('switch', { name: /stock/i })).toBeTruthy();
    expect(screen.queryByRole('switch', { name: /works the register desk/i })).toBeNull();
  });

  it('offers a cashier the tag desk, matching the gate', () => {
    renderField([], 'cashier');
    expect(screen.getByRole('switch', { name: /works the register desk/i })).toBeTruthy();
    expect(screen.queryByRole('switch', { name: /stock/i })).toBeNull();
  });

  it('leaves a grant the surface does not show untouched when toggling one it does', () => {
    // A stall operator who somehow carries issue_tags must not silently lose it
    // because this surface cannot render it.
    const onChange = vi.fn();
    render(
      <OperatorGrantsField population="merchant" value={['issue_tags']} onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole('switch', { name: /stock/i }));
    expect(onChange).toHaveBeenCalledWith(['issue_tags', 'manage_stock']);
  });
});
```

That last test is the one that matters most: filtering what is *displayed* must never become filtering what is *saved*.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/OperatorGrantsField.test.tsx`
Expected: FAIL — `population` is not a prop, and `manage_stock` does not exist.

- [ ] **Step 3: Extend the catalogue**

In `src/lib/api.ts`, replace the grant type and label map:

```ts
/** Which operator population a grant can be held by. A grant means nothing to
 *  a population it isn't listed for — the API's namespace maps agree. */
export type OperatorPopulation = 'gate' | 'cashier' | 'merchant';

export type OperatorGrant = 'issue_tags' | 'manage_stock';

export const OPERATOR_GRANT_LABELS: Record<
  OperatorGrant,
  { label: string; hint: string; appliesTo: OperatorPopulation[] }
> = {
  issue_tags: {
    label: 'Works the Register desk',
    hint: 'Register your tags to an event, and bind one to an attendee\'s ticket',
    appliesTo: ['gate', 'cashier'],
  },
  manage_stock: {
    label: 'Controls this stall\'s stock',
    hint: 'Receive deliveries, write off breakage, and move stock to another stall from the handheld',
    appliesTo: ['merchant'],
  },
};
```

- [ ] **Step 4: Filter by population in the field**

In `src/components/OperatorGrantsField.tsx`, replace the module-level `ALL_GRANTS` constant and the doc comment:

```tsx
import { OPERATOR_GRANT_LABELS, type OperatorGrant, type OperatorPopulation } from '@/lib/api';

/**
 * The per-person capability switches shared by every operator admin surface —
 * a role is the floor, these are the extras. Each surface passes the
 * population it manages and sees only the grants that mean something there:
 * stock is stall-scoped and does nothing on a gate operator, the tag desk does
 * nothing on a stall. Filtering is DISPLAY only — grants this surface cannot
 * render are carried through untouched on save.
 */
export function OperatorGrantsField({
  population,
  value,
  onChange,
  disabled,
  idPrefix = 'grant',
}: {
  population: OperatorPopulation;
  value: OperatorGrant[];
  onChange: (next: OperatorGrant[]) => void;
  disabled?: boolean;
  idPrefix?: string;
}) {
  const grants = (Object.keys(OPERATOR_GRANT_LABELS) as OperatorGrant[])
    .filter((g) => OPERATOR_GRANT_LABELS[g].appliesTo.includes(population));

  const toggle = (grant: OperatorGrant, on: boolean) =>
    onChange(on ? [...new Set([...value, grant])] : value.filter((g) => g !== grant));
```

then map over `grants` instead of `ALL_GRANTS`. Leave the row markup unchanged.

- [ ] **Step 5: Update the three existing call sites**

Add the prop; change nothing else at these sites.
- `src/components/CashiersPanel.tsx:116` → `population="cashier"`
- `src/pages/GateOperatorsPage.tsx:226` → `population="gate"`
- `src/pages/GateOperatorsPage.tsx:335` → `population="gate"`

- [ ] **Step 6: Run the tests**

Run: `npx vitest run src/components/__tests__/OperatorGrantsField.test.tsx && npx tsc --noEmit`
Expected: PASS, and tsc clean — the required `population` prop makes any missed call site a compile error, which is the point of it being required rather than optional.

- [ ] **Step 7: Commit**

```bash
git add src/lib/api.ts src/components/OperatorGrantsField.tsx src/components/CashiersPanel.tsx src/pages/GateOperatorsPage.tsx src/components/__tests__/OperatorGrantsField.test.tsx
git commit -m "feat(grants): scope the grant switches to the population that can hold them"
```

---

### Task 2: Carry grants through the stall-operator API client

**Files:**
- Modify: `src/lib/api.ts:1259-1280` (`merchantOperators.create` / `.update`), `:1935-1945` (`MerchantOperatorRow`)
- Test: none of its own — Task 3's panel tests exercise it end to end.

**Interfaces:**
- Produces: `MerchantOperatorRow` gains `grants?: OperatorGrant[]`; `create(merchantId, { fullName, phoneNumber?, grants? })`; `update(id, { fullName?, isActive?, grants? })`.

- [ ] **Step 1: Extend the row type**

In `src/lib/api.ts`, add to `MerchantOperatorRow` after `isActive`:

```ts
  /** Per-person capability grants. Optional: rows created before the field
   *  existed come back without it, and `?? []` is the correct read. */
  grants?: OperatorGrant[];
```

- [ ] **Step 2: Extend the two call signatures**

```ts
    create: async (
      merchantId: string,
      data: { fullName: string; phoneNumber?: string; grants?: OperatorGrant[] },
    ): Promise<IssuedMerchantOperatorCredentials> =>
```

```ts
    update: async (
      id: string,
      data: { fullName?: string; isActive?: boolean; grants?: OperatorGrant[] },
    ): Promise<{ operator: MerchantOperatorRow }> =>
```

Both bodies already `JSON.stringify(data)` — no body change. Because `grants` is optional and only serialized when present, a name-only PATCH still omits the key, which is what the API's `if ('grants' in req.body)` guard requires.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat(grants): accept and return grants on the stall-operator client"
```

---

### Task 3: The grant switch on the stall-operators panel

**Files:**
- Modify: `src/components/StallOperatorsPanel.tsx`
- Test: `src/components/__tests__/StallOperatorsPanel.test.tsx` (create)

**Interfaces:**
- Consumes: `OperatorGrantsField` with `population="merchant"` (Task 1); `merchantOperators.create/update` with `grants` (Task 2).
- Produces: the add-someone dialog carries a grants switch; each listed operator has one that saves on toggle.

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/StallOperatorsPanel.test.tsx`. Mock the API client so no network is touched, following the file-level mock style used elsewhere in this suite:

```tsx
// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StallOperatorsPanel } from '@/components/StallOperatorsPanel';

const list = vi.fn();
const create = vi.fn();
const update = vi.fn();

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    apiClient: {
      merchantOperators: {
        list: (...a: unknown[]) => list(...a),
        create: (...a: unknown[]) => create(...a),
        update: (...a: unknown[]) => update(...a),
        resetPin: vi.fn(),
      },
    },
  };
});

const renderPanel = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <StallOperatorsPanel merchantId="m1" stallName="Sandwich Stall" />
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  list.mockResolvedValue({
    operators: [
      { _id: 'op1', fullName: 'Nomsa Shongwe', merchantId: 'm1', eventId: 'e1',
        loginCode: '123456', isActive: true, grants: [], createdAt: '2026-09-05T00:00:00.000Z' },
    ],
  });
  create.mockResolvedValue({
    operator: { _id: 'op2', fullName: 'Sipho Mabuza' }, loginCode: '654321', pin: '111111',
  });
  update.mockResolvedValue({ operator: { _id: 'op1', grants: ['manage_stock'] } });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('StallOperatorsPanel grants', () => {
  it('offers the stock switch on an existing operator and saves it on toggle', async () => {
    renderPanel();
    const sw = await screen.findByRole('switch', { name: /stock/i });
    fireEvent.click(sw);
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith('op1', { grants: ['manage_stock'] }),
    );
  });

  it('does not offer the register-desk grant to stall staff', async () => {
    renderPanel();
    await screen.findByText('Nomsa Shongwe');
    expect(screen.queryByRole('switch', { name: /works the register desk/i })).toBeNull();
  });

  it('sends grants when adding someone with the switch on', async () => {
    renderPanel();
    await screen.findByText('Nomsa Shongwe');
    fireEvent.click(screen.getByRole('button', { name: /add/i }));
    fireEvent.change(await screen.findByLabelText(/name/i), { target: { value: 'Sipho Mabuza' } });
    fireEvent.click(screen.getByRole('switch', { name: /stock/i }));
    fireEvent.click(screen.getByRole('button', { name: /add|create|save/i }));
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith('m1', expect.objectContaining({ grants: ['manage_stock'] })),
    );
  });

  it('does not send grants when only the name changes', async () => {
    // Guards the API's `if ('grants' in req.body)` contract from the client side:
    // a name-only edit must not clear an operator's grants.
    renderPanel();
    await screen.findByText('Nomsa Shongwe');
    expect(update).not.toHaveBeenCalledWith('op1', expect.objectContaining({ grants: expect.anything() }));
  });
});
```

Read the panel before finalising the queries above — its Add button label, name field label, and submit button text must match what it actually renders (`Add someone to {stallName}` dialog, `op-name` input). Adjust the selectors to the real markup rather than changing the markup to suit the test.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/StallOperatorsPanel.test.tsx`
Expected: FAIL — no stock switch is rendered.

- [ ] **Step 3: Add grants to the add-someone form**

In `src/components/StallOperatorsPanel.tsx`:

```tsx
import { OperatorGrantsField } from '@/components/OperatorGrantsField';
import { apiClient, type OperatorGrant } from '@/lib/api';
```

Extend the form state (line ~24) and its reset (line ~41):

```tsx
  const [form, setForm] = useState<{ fullName: string; phoneNumber: string; grants: OperatorGrant[] }>(
    { fullName: '', phoneNumber: '', grants: [] },
  );
```
```tsx
      setForm({ fullName: '', phoneNumber: '', grants: [] });
```

Send them in `create.mutationFn` (line ~35), alongside the existing fields:

```tsx
      grants: form.grants,
```

And inside the dialog `<form>`, after the phone number field:

```tsx
              <div className="space-y-2">
                <Label>Extra permissions</Label>
                <OperatorGrantsField
                  population="merchant"
                  idPrefix="stall-op"
                  value={form.grants}
                  onChange={(grants) => setForm((f) => ({ ...f, grants }))}
                />
              </div>
```

- [ ] **Step 4: Add a per-operator switch to the list**

Add a mutation beside the existing `setActive` one:

```tsx
  const setGrants = useMutation({
    mutationFn: ({ id, grants }: { id: string; grants: OperatorGrant[] }) =>
      apiClient.merchantOperators.update(id, { grants }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['merchant-operators', merchantId] }),
    onError: (e: Error) => toast.error(e.message),
  });
```

Use the query key the file already uses — read it from the `useQuery` at line ~29 rather than assuming the shape above.

Then in the operator row, below the name:

```tsx
                <OperatorGrantsField
                  population="merchant"
                  idPrefix={`stall-op-${op._id}`}
                  value={op.grants ?? []}
                  disabled={setGrants.isPending}
                  onChange={(grants) => setGrants.mutate({ id: op._id, grants })}
                />
```

This mirrors `GateOperatorsPage.tsx:335` exactly — same shape, same save-on-toggle behaviour.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/components/__tests__/StallOperatorsPanel.test.tsx && npx tsc --noEmit`
Expected: PASS, tsc clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/StallOperatorsPanel.tsx src/components/__tests__/StallOperatorsPanel.test.tsx
git commit -m "feat(grants): organizers can switch stock control on for a stall operator"
```

---

### Task 4: Show who moved the stock

**Files:**
- Modify: `src/lib/api.ts` (`StockMovementRow`)
- Modify: `src/components/EventStockReport.tsx` (`MovementsSection` table)
- Test: `src/components/__tests__/EventStockReportMovements.test.tsx` (create)

**Interfaces:**
- Consumes: the API's `byName: string | null` on each movement row (already shipped).
- Produces: a "Who" column in the movements table.

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/EventStockReportMovements.test.tsx`, mocking the client the same way Task 3 does, and rendering the exported component that owns the movements table. If `MovementsSection` is not exported, render `EventStockReport` and mock all four report queries — read the file and choose whichever gives the smaller test.

```tsx
it('names the stall operator who wrote a movement', async () => {
  // byName is resolved server-side; the table shows it verbatim.
  await renderMovements([
    { id: 'm1', at: '2026-09-05T10:00:00.000Z', merchantId: 'b1', merchantName: 'Sandwich Stall',
      productId: 'p1', productName: 'Castle Lite', delta: 24, reason: 'receive', balanceAfter: 24,
      refType: null, refId: null, byType: 'Merchant', by: 'op1', byName: 'Nomsa Shongwe', note: null },
  ]);
  expect(await screen.findByText('Nomsa Shongwe')).toBeTruthy();
});

it('shows a dash rather than a raw id for organizer-written rows', async () => {
  // byName is null for byType 'Organizer' — their `by` is a vendor id, not a
  // person, and printing a hex string in a Who column is worse than a dash.
  await renderMovements([
    { id: 'm2', at: '2026-09-05T10:00:00.000Z', merchantId: 'b1', merchantName: 'Sandwich Stall',
      productId: 'p1', productName: 'Castle Lite', delta: 100, reason: 'receive', balanceAfter: 124,
      refType: null, refId: null, byType: 'Organizer', by: '64b000000000000000000a01', byName: null, note: null },
  ]);
  expect(await screen.findByText('Castle Lite')).toBeTruthy();
  expect(screen.queryByText('64b000000000000000000a01')).toBeNull();
});

it('renders a spoilage row with its own badge', async () => {
  // The first movements ever written with reason 'spoilage' arrive with this
  // feature; REASON_CLASS already styles it, so this only guards the wiring.
  await renderMovements([
    { id: 'm3', at: '2026-09-05T10:00:00.000Z', merchantId: 'b1', merchantName: 'Sandwich Stall',
      productId: 'p1', productName: 'Castle Lite', delta: -6, reason: 'spoilage', balanceAfter: 18,
      refType: null, refId: null, byType: 'Merchant', by: 'op1', byName: 'Nomsa Shongwe', note: 'crate dropped' },
  ]);
  expect(await screen.findByText('spoilage')).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/EventStockReportMovements.test.tsx`
Expected: FAIL — no operator name is rendered; `byName` isn't on the type.

- [ ] **Step 3: Add the field to the row type**

In `src/lib/api.ts`, in `StockMovementRow`, after `by: string;`:

```ts
  /** The person, when one is knowable: the stall operator's name for
   *  byType 'Merchant'. Null for organizer/platform rows, whose `by` is a
   *  vendor id rather than a human. */
  byName: string | null;
```

- [ ] **Step 4: Add the column**

In `src/components/EventStockReport.tsx`, in `MovementsSection`'s table header, after the Reason head:

```tsx
                  <TableHead className="hidden md:table-cell">Who</TableHead>
```

and in the body row, after the Reason cell:

```tsx
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {m.byName ?? '—'}
                    </TableCell>
```

`hidden md:table-cell` matches the existing responsive treatment of the When column, so the table stays readable on a phone.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/components/__tests__/EventStockReportMovements.test.tsx && npx tsc --noEmit`
Expected: PASS, tsc clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/api.ts src/components/EventStockReport.tsx src/components/__tests__/EventStockReportMovements.test.tsx
git commit -m "feat(stock): show who wrote each movement in the log"
```

---

### Task 5: Verify and ship

**Files:** none — verification only.

- [ ] **Step 1: Typecheck, lint, full suite**

Run: `npx tsc --noEmit`, then `npm run lint` (compare against `origin/main`'s baseline — only NEW errors are yours), then `npm test`.
Expected: tsc clean, no new lint errors, suite green.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: clean — this is what Cloudflare Pages will run.

- [ ] **Step 3: Land**

The dashboard is git-connected on Cloudflare Pages: `keshless-tickets-admin` builds `main` → manage.carrottickets.com, `carrot-tickets-admin-dev` builds `dev`. A push deploys.

```bash
git fetch origin
git rev-list --count HEAD..origin/main   # must be 0
git push origin <branch>:dev             # verify on dev-manage.carrottickets.com first
git push origin <branch>:main
```

Ship to `dev` first and click through the stall-operators panel — this slice has real UI, unlike the API slice.

- [ ] **Step 4: Verify the deploy**

Pages deployments are on the **contracts** Cloudflare account (`9f074c8dd70baaa27e08c1602bdec69a`), not hiyebo; the token is `CONTRACTS_CLOUDFLARE__API_TOKEN` in Secret Manager project `contracts-470406`. That account rejects `per_page` — page with `?page=N`:

```
GET /accounts/<id>/pages/projects/keshless-tickets-admin/deployments
```

Then confirm the live bundle actually carries the change (the same trick used to verify the POS link): fetch `https://manage.carrottickets.com/`, find the `/assets/index-*.js` bundle, and grep it for a string only this change introduces.

---

## What this plan does NOT cover

The POS Stock tab (`../pos-app-stockgrant-wt/docs/superpowers/plans/2026-09-05-stock-grant-pos.md`), and the API change that lets the POS see its permissions (`../api-stockgrant-wt/docs/superpowers/plans/2026-09-05-merchant-permissions-in-login-response.md`). This plan is independent of both and can ship first — an organizer can grant `manage_stock` and see the Who column before any POS build exists; the grant simply has no client using it yet.
