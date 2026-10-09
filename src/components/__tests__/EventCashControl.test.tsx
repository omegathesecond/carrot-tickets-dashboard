// @vitest-environment jsdom
import { afterEach, it, expect, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EventCashControl } from '@/components/cashless/EventCashControl';
const report = vi.fn();
vi.mock('@/lib/api', () => ({ apiClient: { cashCollections: { report: (...a: unknown[]) => report(...a) } } }));
afterEach(cleanup);
function renderReport() { render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><EventCashControl eventId="e1" /></QueryClientProvider>); }
it('shows cash location, confirmation status and the two people in the audit record', async () => {
  report.mockResolvedValue({ currency: 'SZL', cashTopups: 10000, cardTopups: 90000, cashOnHand: 2000, collectorHeld: 8000, pendingCount: 1,
    cashiers: [{ id: 'cash1', fullName: 'Nomsa', isActive: true, cashTopups: 10000, cardTopups: 90000, cashWithdrawals: 0, collected: 8000, cashOnHand: 2000 }],
    collectors: [{ id: 'collector1', fullName: 'Thabo', held: 8000 }],
    collections: [{ _id: 'pick1', cashierName: 'Nomsa', collectorName: 'Thabo', amount: 8000, status: 'confirmed', createdAt: '2026-10-09T10:00:00Z', resolvedAt: '2026-10-09T10:01:00Z' }],
  });
  renderReport(); await waitFor(() => expect(screen.getByText('Cash control')).toBeTruthy());
  expect(screen.getAllByText('E900.00')).toHaveLength(2);
  expect(screen.getAllByText('Cash to collect')).toHaveLength(2);
  expect(screen.getAllByText('E20.00')).toHaveLength(2);
  expect(report).toHaveBeenCalledWith('e1'); expect(screen.getByText('Held by collectors')).toBeTruthy();
  expect(screen.getAllByText('E80.00').length).toBeGreaterThan(1); expect(screen.getByText('Confirmed by cashier')).toBeTruthy();
  expect(screen.getAllByText('Nomsa').length).toBe(2); expect(screen.getAllByText('Thabo').length).toBe(2);
});
it('surfaces an API error instead of showing fabricated cash totals', async () => {
  report.mockRejectedValue(new Error('Cash records unavailable')); renderReport();
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Cash records unavailable'));
  expect(screen.queryByText('E0.00')).toBeNull();
});
