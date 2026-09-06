// @vitest-environment jsdom
//
// "under the waiters you did not create 2 tabs, one for waiters, then the
// other tables, so we can see activity" — 2026-09-06
//
// The Waiters area listed the staff you hired and nothing about what they were
// doing. The API already reported the floor's tables to an organizer
// (GET /tickets/events/:id/tables); nothing on the dashboard read it.
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WaitersPanel } from '@/components/WaitersPanel';

const listWaiters = vi.fn();
const getEventTables = vi.fn();

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    apiClient: {
      waiters: { list: (...a: unknown[]) => listWaiters(...a) },
      events: { getEventTables: (...a: unknown[]) => getEventTables(...a) },
    },
  };
});

const WAITER = {
  _id: 'w1', fullName: 'Marcia Dlamini', eventId: 'e1', isActive: true,
  loginCode: 'B851F0', grants: [], createdAt: '2026-09-05T10:00:00.000Z',
};

const table = (over: Record<string, unknown>) => ({
  _id: 't1', label: '1', status: 'open', openedBy: 'w1', items: [],
  subtotal: 61000, createdAt: '2026-09-06T10:00:00.000Z', ...over,
});

function renderPanel() {
  listWaiters.mockResolvedValue([WAITER]);
  getEventTables.mockResolvedValue({
    open: [table({ _id: 't1', label: '1', items: [{}, {}, {}], subtotal: 61000 })],
    settled: [
      table({
        _id: 't2', label: 'Mza', status: 'settled', subtotal: 6000,
        fulfilment: [
          { merchantId: 'm1', status: 'collected' },
          { merchantId: 'm2', status: 'handed_out' },
        ],
      }),
      table({
        _id: 't3', label: '2', status: 'settled', subtotal: 9000,
        fulfilment: [{ merchantId: 'm1', status: 'collected' }],
      }),
    ],
    voided: [table({ _id: 't4', label: '9', status: 'voided', voidReason: 'walked out' })],
    totals: { openValue: 61000, settledValue: 15000, voidedValue: 0 },
  });

  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <WaitersPanel eventId="e1" />
    </QueryClientProvider>,
  );
}

/** Radix's TabsTrigger selects on POINTER-DOWN, not click. */
const openTab = (name: string) => {
  const el = screen.getByRole('tab', { name });
  fireEvent.pointerDown(el, { button: 0, ctrlKey: false, pointerType: 'mouse' });
  fireEvent.mouseDown(el, { button: 0 });
  fireEvent.click(el);
};

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('the Waiters area has two tabs', () => {
  it('offers Waiters and Tables', () => {
    renderPanel();
    expect(screen.getByRole('tab', { name: 'Waiters' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Tables' })).toBeTruthy();
  });

  it('opens on the staff list', async () => {
    renderPanel();
    expect(screen.getByRole('tab', { name: 'Waiters' }).getAttribute('data-state')).toBe('active');
    expect(await screen.findByText('Marcia Dlamini')).toBeTruthy();
  });

  it('shows the floor only once Tables is chosen', async () => {
    renderPanel();
    expect(screen.queryByText(/Every table your waiters opened/i)).toBeNull();

    openTab('Tables');

    expect(await screen.findByText(/Every table your waiters opened/i)).toBeTruthy();
  });
});

describe('the Tables tab reports the floor', () => {
  it('opens on the open tables and counts each status', async () => {
    renderPanel();
    openTab('Tables');
    // Await a ROW, not the panel's static header: the header renders before
    // the query settles, and the counts would read 0.
    await screen.findByText('Marcia Dlamini');

    const group = screen.getByRole('group', { name: 'Filter tables by status' });
    expect(within(group).getByRole('button', { name: /^Open/ }).textContent).toContain('1');
    expect(within(group).getByRole('button', { name: /^Settled/ }).textContent).toContain('2');
    expect(within(group).getByRole('button', { name: /^Voided/ }).textContent).toContain('1');
  });

  it('names the waiter who opened a table, not their id', async () => {
    renderPanel();
    openTab('Tables');

    expect(await screen.findByText('Marcia Dlamini')).toBeTruthy();
    expect(screen.queryByText('w1')).toBeNull();
  });

  it('shows how far a settled table\'s handover has got', async () => {
    renderPanel();
    openTab('Tables');
    await screen.findByText('Marcia Dlamini');

    const group = screen.getByRole('group', { name: 'Filter tables by status' });
    fireEvent.click(within(group).getByRole('button', { name: /^Settled/ }));

    // One stall collected of two, and the other is waiting on the waiter.
    expect(await screen.findByText('/2 collected')).toBeTruthy();
    expect(screen.getByText('1 ready')).toBeTruthy();
    // The fully-collected one says so outright rather than "1/1".
    expect(screen.getByText('All collected')).toBeTruthy();
  });

  it('shows an OPEN table no handover — there is none before the money', async () => {
    renderPanel();
    openTab('Tables');
    const row = (await screen.findByText('Marcia Dlamini')).closest('tr')!;
    expect(within(row).getByText('—')).toBeTruthy();
  });

  it('gives a voided table its reason instead of a handover', async () => {
    renderPanel();
    openTab('Tables');
    await screen.findByText('Marcia Dlamini');

    const group = screen.getByRole('group', { name: 'Filter tables by status' });
    fireEvent.click(within(group).getByRole('button', { name: /^Voided/ }));

    expect(await screen.findByText('walked out')).toBeTruthy();
  });

  it('searches by table label or by waiter', async () => {
    renderPanel();
    openTab('Tables');
    await screen.findByText('Marcia Dlamini');

    const box = screen.getByPlaceholderText(/Search table or waiter/i);
    // Matching on the WAITER's name, though the query is not the table label.
    fireEvent.change(box, { target: { value: 'marcia' } });
    expect(screen.getByText('Marcia Dlamini')).toBeTruthy();

    fireEvent.change(box, { target: { value: 'nobody' } });
    expect(screen.getByText(/No table matches/i)).toBeTruthy();
    expect(screen.queryByText('Marcia Dlamini')).toBeNull();
  });
});
