// @vitest-environment jsdom
import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TagWithdrawalsPage } from '../TagWithdrawalsPage';
import { apiClient } from '@/lib/api';
import type { TagWithdrawalRequest } from '@/types/tagWithdrawal';
vi.mock('@/lib/api', () => ({ apiClient: { tagWithdrawals: { list: vi.fn(), detail: vi.fn(), decide: vi.fn() } } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { _id: 'admin-1' } }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
let row: TagWithdrawalRequest;
function page() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter><TagWithdrawalsPage /></MemoryRouter></QueryClientProvider>);
}
beforeEach(() => {
  vi.clearAllMocks();
  row = { _id: 'request-1', eventId: 'event-1', walletId: 'wallet-1', eventName: 'Festival', bandUid: '0ae98d36', amount: 12345,
    currency: 'ZAR', country: 'ZA', method: 'bank_transfer', status: 'pending', destinationSummary: 'Test Bank ••••8901',
    createdAt: '2026-10-29T12:00:00Z', history: [], details: { fullName: 'Attendee', contactPhone: '+26878422613',
      bank: { country: 'South Africa', bank: 'Test Bank', accountHolder: 'Attendee', accountType: 'Savings', branchCode: '123456', accountNumber: '012345678901' } } };
  vi.mocked(apiClient.tagWithdrawals.list).mockImplementation(async () => ({ items: [row], total: 1, page: 1 }));
  vi.mocked(apiClient.tagWithdrawals.detail).mockImplementation(async () => ({ ...row }));
  vi.mocked(apiClient.tagWithdrawals.decide).mockImplementation(async (_id, data) => {
    row = { ...row, status: data.status, processingBy: 'admin-1', paymentReference: data.paymentReference }; return row;
  });
});
afterEach(cleanup);
it('requires processing before showing payment details, then requires a reference and confirmation', async () => {
  page(); fireEvent.click(await screen.findByRole('button', { name: 'Review' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Start processing' }));
  await screen.findByRole('heading', { name: 'Confirm completed payment' });
  expect(screen.getByText('012345678901')).toBeTruthy();
  const confirm = screen.getByRole('button', { name: 'Confirm paid' }) as HTMLButtonElement;
  expect(confirm.disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('Payment reference'), { target: { value: 'BANK-123' } });
  fireEvent.click(screen.getByRole('checkbox', { name: 'I have sent this payment and confirmed it completed.' }));
  expect(confirm.disabled).toBe(false); fireEvent.click(confirm);
  await waitFor(() => expect(apiClient.tagWithdrawals.decide).toHaveBeenCalledWith('request-1', { status: 'paid', paymentReference: 'BANK-123', paymentCompleted: true }));
});
it('blocks a second administrator from paying a claimed request', async () => {
  row = { ...row, status: 'processing', processingBy: 'another-admin' };
  page(); fireEvent.click(await screen.findByRole('button', { name: 'Review' }));
  await screen.findByText(/Another administrator is processing/);
  expect(screen.queryByRole('button', { name: 'Confirm paid' })).toBeNull();
  expect(screen.queryByText('012345678901')).toBeNull();
});
it('shows load failures instead of an empty queue', async () => {
  vi.mocked(apiClient.tagWithdrawals.list).mockRejectedValue(new Error('Service unavailable'));
  page(); expect((await screen.findByRole('alert')).textContent).toContain('Service unavailable');
  expect(screen.queryByText('No withdrawal requests match these filters.')).toBeNull();
});
