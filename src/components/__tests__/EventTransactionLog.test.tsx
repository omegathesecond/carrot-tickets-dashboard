// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EventTransactionLog } from '@/components/cashless/EventTransactionLog';

afterEach(cleanup);

const getTransactions = vi.fn();
vi.mock('@/lib/api', () => ({
  apiClient: { events: { getEventCashlessTransactions: (...a: unknown[]) => getTransactions(...a) } },
}));

const TOPUP = {
  id: 'txn1',
  type: 'topup' as const,
  amount: 50000,
  at: '2026-08-19T17:49:00.000Z',
  actorName: 'Demo Cashier',
  actorType: 'Cashier',
  ref: 'desk-0001',
  status: 'completed',
  tagUid: '04AABBCC',
  walletId: 'w1',
};

function renderLog() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <EventTransactionLog eventId="e1" />
    </QueryClientProvider>,
  );
}

describe('EventTransactionLog', () => {
  it('shows the reference, tag and status a support query is traced by', async () => {
    getTransactions.mockResolvedValue({ transactions: [TOPUP], page: 1, limit: 50, hasMore: false });

    renderLog();

    await waitFor(() => expect(screen.getByText('desk-0001')).toBeDefined());
    expect(screen.getByText('04AABBCC')).toBeDefined();
    expect(screen.getByText('completed')).toBeDefined();
    expect(screen.getByText('Demo Cashier')).toBeDefined();
  });

  it('reads a dash rather than blank when a movement was not on a tag', async () => {
    getTransactions.mockResolvedValue({
      transactions: [{ ...TOPUP, tagUid: null, ref: null }], page: 1, limit: 50, hasMore: false,
    });

    renderLog();

    await waitFor(() => expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2));
  });

  it('searches the SERVER by tag, not the page it happens to be on', async () => {
    getTransactions.mockResolvedValue({ transactions: [TOPUP], page: 1, limit: 50, hasMore: false });
    renderLog();
    await waitFor(() => expect(screen.getByText('desk-0001')).toBeDefined());

    fireEvent.change(screen.getByPlaceholderText('Search by tag ID'), { target: { value: '04OLDTAG' } });

    await waitFor(() =>
      expect(getTransactions).toHaveBeenCalledWith('e1', expect.objectContaining({ tagUid: '04OLDTAG' })),
    );
  });

  it('says the search found nothing, rather than looking like an empty event', async () => {
    getTransactions.mockResolvedValue({ transactions: [], page: 1, limit: 50, hasMore: false });
    renderLog();
    await waitFor(() => expect(screen.getByText('No transactions yet.')).toBeDefined());

    fireEvent.change(screen.getByPlaceholderText('Search by tag ID'), { target: { value: 'ZZZZ' } });

    await waitFor(() => expect(screen.getByText(/Nothing moved on a tag matching/)).toBeDefined());
  });

  it('pages forward through a long log', async () => {
    getTransactions.mockResolvedValue({ transactions: [TOPUP], page: 1, limit: 50, hasMore: true });
    renderLog();
    await waitFor(() => expect(screen.getByText('Page 1')).toBeDefined());

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() =>
      expect(getTransactions).toHaveBeenCalledWith('e1', expect.objectContaining({ page: 2 })),
    );
  });
});
