// @vitest-environment jsdom
import { it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EventCouponsTab } from '@/components/EventCouponsTab';
import { apiClient } from '@/lib/api';
import type { Event } from '@/types';

vi.mock('@/lib/api', () => ({ apiClient: { coupons: { list: vi.fn(), create: vi.fn(), disable: vi.fn() } } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const event = { _id: 'e1', currency: 'SZL', ticketTypes: [{ _id: 't1', name: 'General', price: 100 }] } as Event;
function show() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><EventCouponsTab eventId="e1" event={event} /></QueryClientProvider>);
}
it('generates a batch with explicit discount terms and displays copyable codes', async () => {
  vi.mocked(apiClient.coupons.list).mockResolvedValue({ coupons: [], page: 1, total: 0 });
  vi.mocked(apiClient.coupons.create).mockResolvedValue({ coupons: [{ code: 'CT-0123456789ABCDEF' }] } as any);
  show();
  await screen.findByText('No coupons yet. Generate your first code above.');
  fireEvent.change(screen.getByLabelText('Number of unique codes'), { target: { value: '10' } });
  fireEvent.change(screen.getByLabelText('Percentage (up to 100%)'), { target: { value: '25' } });
  fireEvent.change(screen.getByLabelText('Label or recipient (optional)'), { target: { value: 'VIP guests' } });
  fireEvent.click(screen.getByRole('button', { name: 'Generate codes' }));
  await waitFor(() => expect(apiClient.coupons.create).toHaveBeenCalledWith('e1', { count: 10, label: 'VIP guests', discountType: 'percentage', discountValue: 25, ticketTypeIds: [] }));
  expect(await screen.findByText('CT-0123456789ABCDEF')).toBeTruthy();
});
it('shows a real error when usage cannot load rather than pretending there are no coupons', async () => {
  vi.mocked(apiClient.coupons.list).mockRejectedValue(new Error('Service unavailable'));
  show();
  expect((await screen.findByRole('alert')).textContent).toContain('Service unavailable');
  expect(screen.queryByText('No coupons yet. Generate your first code above.')).toBeNull();
});
it('shows used and pending codes without offering to disable or reset them', async () => {
  const base = { code: 'CT-0123456789ABCDEF', label: 'Sarah', discountType: 'percentage', discountValue: 50, ticketTypeIds: [] };
  vi.mocked(apiClient.coupons.list).mockResolvedValue({ total: 2, page: 1, coupons: [
    { ...base, _id: 'c1', status: 'used', redemption: { customerName: 'Sarah', discountAmount: 50, usedAt: '2026-10-16T10:20:00Z', saleId: 's1' } },
    { ...base, _id: 'c2', code: 'CT-FEDCBA9876543210', status: 'pending', redemption: null },
  ] } as any);
  show();
  expect(await screen.findByText('Used')).toBeTruthy();
  expect(screen.getByText('Payment pending')).toBeTruthy();
  expect(screen.getByText(/Redeemed by Sarah/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Disable' })).toBeNull();
});
