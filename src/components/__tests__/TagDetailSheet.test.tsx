// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TagDetailSheet } from '@/components/cashless/TagDetailSheet';
import { fmtR } from '@/lib/money';

afterEach(cleanup);

const detail = vi.fn();
vi.mock('@/lib/api', () => ({ apiClient: { tags: { detail: (...a: unknown[]) => detail(...a) } } }));

const money = (cents: number) => (t: string) =>
  t.replace(/\s/g, '') === fmtR(cents).replace(/\s/g, '');

const DETAIL = {
  walletId: 'w1', bandUid: 'UID2', status: 'active',
  balance: 7500, cashFundedBalance: 2500,
  holder: { name: 'Thandi Dlamini', phone: '+26876001234', ticketCode: 'ABC123' },
  bindings: [
    { bandUid: 'UID2', boundAt: '2026-08-01T18:05:00Z', boundBy: 'gate-op-2', unboundAt: null, unboundReason: null },
    { bandUid: 'UID1', boundAt: '2026-08-01T10:00:00Z', boundBy: 'gate-op-1', unboundAt: '2026-08-01T18:00:00Z', unboundReason: 'lost at the bar' },
  ],
  movements: [
    { kind: 'spend', amount: 2500, at: '2026-08-01T19:00:00Z', label: 'Main Bar' },
    { kind: 'topup', amount: 10000, at: '2026-08-01T17:00:00Z', label: 'Top-up' },
  ],
};

function renderSheet() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <TagDetailSheet eventId="e1" walletId="w1" onClose={() => {}} />
    </QueryClientProvider>,
  );
}

describe('TagDetailSheet', () => {
  it('shows the holder and the balance', async () => {
    detail.mockResolvedValue(DETAIL);
    renderSheet();

    await waitFor(() => expect(screen.getByText('Thandi Dlamini')).toBeDefined());
    expect(screen.getByText(money(7500))).toBeDefined();
  });

  it('shows why an earlier tag was released', async () => {
    detail.mockResolvedValue(DETAIL);
    renderSheet();

    await waitFor(() => expect(screen.getByText(/lost at the bar/i)).toBeDefined());
  });

  it('lists spends with the stall that took the money', async () => {
    detail.mockResolvedValue(DETAIL);
    renderSheet();

    await waitFor(() => expect(screen.getByText('Main Bar')).toBeDefined());
  });

  it('marks the tag currently in the attendee\'s hand', async () => {
    detail.mockResolvedValue(DETAIL);
    renderSheet();

    await waitFor(() => expect(screen.getByText('Current')).toBeDefined());
  });
});
