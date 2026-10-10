// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EventTagsPanel } from '@/components/cashless/EventTagsPanel';
import { fmtR } from '@/lib/money';

// en-ZA separates thousands with a non-breaking space, which Testing Library's
// normalizer treats differently on either side of the comparison — match on the
// digits instead of trying to reproduce the locale's whitespace.
const money = (cents: number) => (t: string) =>
  t.replace(/\s/g, '') === fmtR(cents).replace(/\s/g, '');

afterEach(cleanup);
// The mocks below are module-level and shared, and one test asserts HOW MANY
// requests the panel made — so call history must not leak between tests.
beforeEach(() => vi.clearAllMocks());

const summary = vi.fn();
const list = vi.fn();
vi.mock('@/lib/api', () => ({
  apiClient: { tags: { summary: (...a: unknown[]) => summary(...a), list: (...a: unknown[]) => list(...a), detail: vi.fn() } },
}));

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <EventTagsPanel eventId="e1" />
    </QueryClientProvider>,
  );
}

describe('EventTagsPanel', () => {
  it('shows what is still owed to attendees', async () => {
    summary.mockResolvedValue({
      tagsInUse: 12, activeTags: 11, unboundTags: 1,
      balanceOutstanding: 123400, cashFundedOutstanding: 40000, averageBalance: 10283,
    });
    list.mockResolvedValue({ tags: [], hasMore: false, nextCursor: null });

    renderPanel();

    await waitFor(() => expect(screen.getByText(money(123400))).toBeDefined());
    expect(screen.getByText('12')).toBeDefined();
  });

  it('lists a tag with its holder and balance', async () => {
    summary.mockResolvedValue({
      tagsInUse: 1, activeTags: 1, unboundTags: 0,
      balanceOutstanding: 5000, cashFundedOutstanding: 0, averageBalance: 5000,
    });
    list.mockResolvedValue({
      tags: [{
        walletId: 'w1', bandUid: 'UID123', status: 'active',
        balance: 5000, cashFundedBalance: 0,
        holder: { name: 'Thandi Dlamini', phone: '+26876001234', ticketCode: 'ABC123' },
      }],
      hasMore: false, nextCursor: null,
    });

    renderPanel();

    await waitFor(() => expect(screen.getByText('Thandi Dlamini')).toBeDefined());
    expect(screen.getByText('UID123')).toBeDefined();
    expect(screen.getAllByText(money(5000)).length).toBeGreaterThan(0);
  });

  it('says so plainly when the event has no tags yet', async () => {
    summary.mockResolvedValue({
      tagsInUse: 0, activeTags: 0, unboundTags: 0,
      balanceOutstanding: 0, cashFundedOutstanding: 0, averageBalance: 0,
    });
    list.mockResolvedValue({ tags: [], hasMore: false, nextCursor: null });

    renderPanel();
    // Funded-only is the default now, so its own empty copy would win here.
    fireEvent.click(screen.getByRole('switch'));

    await waitFor(() => expect(screen.getByText(/no tags issued yet/i)).toBeDefined());
  });

  // The bug this guards: the tags endpoint used to sort newest-registered-first
  // with no balance filter, so at an event that bulk-registers plastic the few
  // tags holding money were scattered across every page and page 1 looked
  // empty. The endpoint now filters and sorts, so what this asserts is that the
  // toggle ASKS IT TO — the panel must not go back to sifting pages itself.
  it('funded only: asks the server for funded tags, biggest balance first', async () => {
    summary.mockResolvedValue({
      tagsInUse: 4, activeTags: 4, unboundTags: 0,
      balanceOutstanding: 18000, cashFundedOutstanding: 18000, averageBalance: 4500,
    });
    const row = (id: string, uid: string, balance: number) => ({
      walletId: id, bandUid: uid, status: 'active' as const,
      balance, cashFundedBalance: balance,
      holder: { name: null, phone: null, ticketCode: null },
    });
    list.mockResolvedValue({
      tags: [row('w4', 'DDD', 12000), row('w2', 'BBB', 6000)],
      hasMore: false, nextCursor: null,
    });

    renderPanel();

    // No click: funded-only is the default.
    await waitFor(() => expect(screen.getByText('DDD')).toBeDefined());
    expect(list).toHaveBeenCalledWith('e1', expect.objectContaining({ funded: true, sort: 'balance' }));
    // Rendered in the order the server returned them — no client-side re-sort.
    const uids = screen.getAllByText(/^(BBB|DDD)$/).map((n) => n.textContent);
    expect(uids).toEqual(['DDD', 'BBB']);

    // ONE request, not a walk of the cursor: the whole point of the server-side
    // filter is that the browser stops dragging thousands of rows over the wire
    // to display a handful.
    expect(list).toHaveBeenCalledTimes(1);
  });

  it('switching funded only off asks for the plain, newest-first list', async () => {
    summary.mockResolvedValue({
      tagsInUse: 2, activeTags: 2, unboundTags: 0,
      balanceOutstanding: 6000, cashFundedOutstanding: 6000, averageBalance: 3000,
    });
    const row = (id: string, uid: string, balance: number) => ({
      walletId: id, bandUid: uid, status: 'active' as const,
      balance, cashFundedBalance: balance,
      holder: { name: null, phone: null, ticketCode: null },
    });
    list.mockResolvedValue({
      tags: [row('w1', 'AAA', 0), row('w2', 'BBB', 6000)],
      hasMore: false, nextCursor: null,
    });

    renderPanel();
    await waitFor(() => expect(screen.getByText('BBB')).toBeDefined());

    fireEvent.click(screen.getByRole('switch'));

    await waitFor(() => expect(screen.getByText('AAA')).toBeDefined());
    const off = list.mock.calls[list.mock.calls.length - 1]![1] as Record<string, unknown>;
    expect(off['funded']).toBeUndefined();
    expect(off['sort']).toBeUndefined();
  });

  // The status and search controls have to travel WITH the funded filter, or
  // the server filters a different set than the organizer is looking at.
  it('funded only: carries the search term alongside the funded filter', async () => {
    summary.mockResolvedValue({
      tagsInUse: 1, activeTags: 1, unboundTags: 0,
      balanceOutstanding: 6000, cashFundedOutstanding: 6000, averageBalance: 6000,
    });
    list.mockResolvedValue({ tags: [], hasMore: false, nextCursor: null });

    renderPanel();
    fireEvent.change(screen.getByPlaceholderText(/search tag uid/i), { target: { value: 'UID9' } });

    await waitFor(() =>
      expect(list).toHaveBeenCalledWith('e1', expect.objectContaining({ funded: true, sort: 'balance', q: 'UID9' })),
    );
  });

  it('funded only: says so when nothing is holding a balance', async () => {
    summary.mockResolvedValue({
      tagsInUse: 2, activeTags: 2, unboundTags: 0,
      balanceOutstanding: 0, cashFundedOutstanding: 0, averageBalance: 0,
    });
    // The endpoint applies the funded filter, so "nothing holding a balance"
    // arrives as an empty page — the panel does not sift rows any more.
    list.mockResolvedValue({ tags: [], hasMore: false, nextCursor: null });

    renderPanel();

    await waitFor(() => expect(screen.getByText('No tags are holding a balance.')).toBeDefined());
  });

  // With the filter on by default, searching an empty tag's UID must not read
  // as "no such tag" — at a cash-out desk that is the wrong conclusion.
  it('funded only: a search that matches nothing funded points at the toggle', async () => {
    summary.mockResolvedValue({
      tagsInUse: 1, activeTags: 1, unboundTags: 0,
      balanceOutstanding: 0, cashFundedOutstanding: 0, averageBalance: 0,
    });
    // EMPTYTAG exists but holds nothing, so a funded search for it comes back
    // empty from the endpoint.
    list.mockResolvedValue({ tags: [], hasMore: false, nextCursor: null });

    renderPanel();
    fireEvent.change(screen.getByPlaceholderText(/search tag uid/i), { target: { value: 'EMPTYTAG' } });

    await waitFor(() => expect(screen.getByText(/switch off funded only/i)).toBeDefined());
  });
});
