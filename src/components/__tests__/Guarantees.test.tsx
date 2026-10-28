// @vitest-environment jsdom
import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Guarantees } from '../Guarantees';
import { apiClient } from '@/lib/api';
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { userType: 'vendor' } }) }));
vi.mock('@/lib/api', () => ({ apiClient: { guarantees: { list: vi.fn(), providers: vi.fn(), submit: vi.fn(), respond: vi.fn(), attach: vi.fn(), agreement: vi.fn() }, analytics: { getEventFinancials: vi.fn() } } }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
const row = { _id: 'r1', eventId: 'e1', providerId: 'p1', providerName: 'Sound provider', organizerName: 'Organizer', eventName: 'Festival', amount: 40, currency: 'SZL', description: 'Sound equipment', expectedPaymentDate: '2026-11-03', status: 'requested', history: [] };
function show(props: { eventId?: string; admin?: boolean } = {}) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><Guarantees {...props}/></QueryClientProvider>);
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(apiClient.guarantees.list).mockResolvedValue([row]);
  vi.mocked(apiClient.guarantees.providers).mockResolvedValue([{ _id: 'p1', businessName: 'Sound provider' }]);
  vi.mocked(apiClient.analytics.getEventFinancials).mockResolvedValue({ currency: 'SZL', custody: { availableNow: 100 } } as any);
});
afterEach(cleanup);
it('blocks submission and explains a Financials outage', async () => {
  vi.mocked(apiClient.analytics.getEventFinancials).mockRejectedValue(new Error('Financials offline'));
  show({ eventId: 'e1' });
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('Financials offline'));
  expect((screen.getByRole('button', { name: 'Submit request' }) as HTMLButtonElement).disabled).toBe(true);
});
it('submits an organizer request using the displayed balance', async () => {
  show({ eventId: 'e1' });
  await screen.findByText('Available ticket-sales balance: SZL 100.00');
  fireEvent.change(screen.getByLabelText('Service provider'), { target: { value: 'p1' } });
  fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '50' } });
  fireEvent.change(screen.getByLabelText('Goods or services'), { target: { value: 'Stage' } });
  fireEvent.change(screen.getByLabelText('Expected payment date'), { target: { value: '2026-11-03' } });
  fireEvent.click(screen.getByRole('button', { name: 'Submit request' }));
  await waitFor(() => expect(apiClient.guarantees.submit).toHaveBeenCalledWith('e1', { providerId: 'p1', amount: 50, description: 'Stage', expectedPaymentDate: '2026-11-03' }, undefined));
});
it('allows a provider to accept with a note and explains Carrot approval', async () => {
  show();
  fireEvent.change(await screen.findByLabelText('Optional note'), { target: { value: 'Confirmed' } });
  fireEvent.click(screen.getByRole('button', { name: 'Accept request' }));
  await waitFor(() => expect(apiClient.guarantees.respond).toHaveBeenCalledWith('r1', 'accepted', 'Confirmed', false));
  expect(screen.getByText(/Provider acceptance is not Carrot approval/)).toBeTruthy();
});
it('offers admin decisions only for an accepted request', async () => {
  vi.mocked(apiClient.guarantees.list).mockResolvedValue([{ ...row, status: 'accepted' }]);
  show({ admin: true });
  fireEvent.click(await screen.findByRole('button', { name: 'Mark Pending' }));
  await waitFor(() => expect(apiClient.guarantees.respond).toHaveBeenCalledWith('r1', 'pending', '', true));
});
it('removes edit and withdraw actions after the provider responds', async () => {
  vi.mocked(apiClient.guarantees.list).mockResolvedValue([{ ...row, status: 'accepted' }]);
  show({ eventId: 'e1' });
  await screen.findByText('Provider accepted — awaiting Carrot review');
  expect(screen.queryByRole('button', { name: 'Edit request' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Withdraw' })).toBeNull();
});
