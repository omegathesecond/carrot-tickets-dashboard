// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TagDetailSheet } from '@/components/cashless/TagDetailSheet';

afterEach(cleanup);

const detail = vi.fn();
const refund = vi.fn();
const deactivate = vi.fn();
vi.mock('@/lib/api', () => ({
  apiClient: {
    tags: {
      detail: (...a: unknown[]) => detail(...a),
      refund: (...a: unknown[]) => refund(...a),
      deactivate: (...a: unknown[]) => deactivate(...a),
      reissue: vi.fn(),
    },
  },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const DETAIL = {
  walletId: 'w1', bandUid: 'UID2', status: 'active',
  balance: 7500, cashFundedBalance: 2500,
  holder: { name: 'Thandi', phone: '+26876001234', ticketCode: 'ABC123' },
  bindings: [], movements: [],
};

function renderSheet() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <TagDetailSheet eventId="e1" walletId="w1" onClose={() => {}} />
    </QueryClientProvider>,
  );
}

describe('TagDetailSheet actions', () => {
  it('defaults the refund to the whole balance', async () => {
    detail.mockResolvedValue(DETAIL);
    renderSheet();

    fireEvent.click(await screen.findByRole('button', { name: /^refund$/i }));

    await waitFor(() => expect((screen.getByLabelText(/amount/i) as HTMLInputElement).value).toBe('75.00'));
  });

  it('sends the refund in cents with an idempotency key', async () => {
    detail.mockResolvedValue(DETAIL);
    refund.mockResolvedValue({ walletId: 'w1', balance: 0 });
    renderSheet();

    fireEvent.click(await screen.findByRole('button', { name: /^refund$/i }));
    fireEvent.click(screen.getByRole('button', { name: /record refund/i }));

    await waitFor(() => expect(refund).toHaveBeenCalled());
    const [eventId, walletId, amount, clientTxnId] = refund.mock.calls[0]!;
    expect([eventId, walletId, amount]).toEqual(['e1', 'w1', 7500]);
    expect(String(clientTxnId).length).toBeGreaterThan(8);
  });

  it('states that the refund only records cash handed over', async () => {
    detail.mockResolvedValue(DETAIL);
    renderSheet();

    fireEvent.click(await screen.findByRole('button', { name: /^refund$/i }));

    expect(screen.getByText(/records cash handed over/i)).toBeDefined();
  });

  it('will not deactivate without a reason', async () => {
    detail.mockResolvedValue(DETAIL);
    renderSheet();

    fireEvent.click(await screen.findByRole('button', { name: /report lost/i }));
    const confirm = screen.getByRole('button', { name: /deactivate tag/i });

    expect(confirm).toHaveProperty('disabled', true);
    fireEvent.click(confirm);
    expect(deactivate).not.toHaveBeenCalled();
  });
});
