// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
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
});
