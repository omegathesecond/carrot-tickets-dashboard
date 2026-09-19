// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest';
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

    await waitFor(() => expect(screen.getByText(/no tags issued yet/i)).toBeDefined());
  });

  // The bug this guards: the tags endpoint sorts newest-registered-first with
  // no balance filter, so at an event that bulk-registers plastic the few tags
  // holding money are scattered across every page and page 1 looks empty.
  it('funded only: keeps just the tags holding money, biggest balance first', async () => {
    summary.mockResolvedValue({
      tagsInUse: 4, activeTags: 4, unboundTags: 0,
      balanceOutstanding: 18000, cashFundedOutstanding: 18000, averageBalance: 4500,
    });
    const row = (id: string, uid: string, balance: number) => ({
      walletId: id, bandUid: uid, status: 'active' as const,
      balance, cashFundedBalance: balance,
      holder: { name: null, phone: null, ticketCode: null },
    });
    // Two server pages; the funded tags sit on both, out of balance order.
    list.mockImplementation(async (_e: string, params: { cursor?: string }) =>
      params?.cursor === 'c1'
        ? { tags: [row('w3', 'CCC', 0), row('w4', 'DDD', 12000)], hasMore: false, nextCursor: null }
        : { tags: [row('w1', 'AAA', 0), row('w2', 'BBB', 6000)], hasMore: true, nextCursor: 'c1' },
    );

    renderPanel();
    await waitFor(() => expect(screen.getByText('AAA')).toBeDefined());

    fireEvent.click(screen.getByRole('switch'));

    // Wait for the scan to RESOLVE, not merely for the old rows to clear —
    // mid-scan the table is empty and every assertion below would pass vacuously.
    await waitFor(() => expect(screen.getByText('DDD')).toBeDefined());
    expect(screen.queryByText('AAA')).toBeNull();
    expect(screen.queryByText('CCC')).toBeNull();
    const uids = screen.getAllByText(/^(AAA|BBB|CCC|DDD)$/).map((n) => n.textContent);
    expect(uids).toEqual(['DDD', 'BBB']);
  });

  it('funded only: says so when nothing is holding a balance', async () => {
    summary.mockResolvedValue({
      tagsInUse: 2, activeTags: 2, unboundTags: 0,
      balanceOutstanding: 0, cashFundedOutstanding: 0, averageBalance: 0,
    });
    list.mockResolvedValue({
      tags: [{
        walletId: 'w1', bandUid: 'AAA', status: 'active', balance: 0, cashFundedBalance: 0,
        holder: { name: null, phone: null, ticketCode: null },
      }],
      hasMore: false, nextCursor: null,
    });

    renderPanel();
    await waitFor(() => expect(screen.getByText('AAA')).toBeDefined());
    fireEvent.click(screen.getByRole('switch'));

    await waitFor(() => expect(screen.getByText('No tags are holding a balance.')).toBeDefined());
  });

  // A partial "who is holding your money" list that looks complete is worse
  // than no list, so the cap has to announce itself.
  it('funded only: warns when the scan hits its page cap', async () => {
    summary.mockResolvedValue({
      tagsInUse: 9999, activeTags: 9999, unboundTags: 0,
      balanceOutstanding: 100, cashFundedOutstanding: 100, averageBalance: 1,
    });
    // Always more — forces the scan to run out of pages.
    list.mockImplementation(async () => ({
      tags: [{
        walletId: 'w1', bandUid: 'AAA', status: 'active', balance: 100, cashFundedBalance: 100,
        holder: { name: null, phone: null, ticketCode: null },
      }],
      hasMore: true, nextCursor: 'next',
    }));

    renderPanel();
    fireEvent.click(screen.getByRole('switch'));

    await waitFor(() => expect(screen.getByText(/did not reach/i)).toBeDefined());
  });
});
