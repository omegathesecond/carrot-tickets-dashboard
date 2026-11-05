// @vitest-environment jsdom
import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TagWithdrawalsPage } from '../TagWithdrawalsPage';
import { apiClient } from '@/lib/api';
import type { TagWithdrawalRequest } from '@/types/tagWithdrawal';
vi.mock('@/lib/api', () => ({ apiClient: { tagWithdrawals: { events: vi.fn(), list: vi.fn(), detail: vi.fn(), decide: vi.fn() } } }));
const auth = vi.hoisted(() => ({ user: { _id: 'admin-1', isSuperAdmin: true, permissions: [] as string[], userType: undefined as 'vendor' | 'sub-user' | undefined } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: auth.user, isLoading: false }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
let row: TagWithdrawalRequest;
function page() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter><TagWithdrawalsPage /></MemoryRouter></QueryClientProvider>);
}
beforeEach(() => {
  vi.clearAllMocks();
  auth.user = { _id: 'admin-1', isSuperAdmin: true, permissions: [], userType: undefined };
  vi.mocked(apiClient.tagWithdrawals.events).mockResolvedValue([{ id: 'event-1', name: 'Festival' }]);
  row = { _id: 'request-1', eventId: 'event-1', walletId: 'wallet-1', eventName: 'Festival', bandUid: '0ae98d36', amount: 12345,
    currency: 'ZAR', country: 'ZA', method: 'bank_transfer', status: 'pending', destinationSummary: 'Test Bank ••••8901',
    createdAt: '2026-10-29T12:00:00Z', history: [], details: { fullName: 'Attendee', contactPhone: '+26878422613',
      bank: { country: 'South Africa', bank: 'Test Bank', accountHolder: 'Attendee', accountType: 'Savings', branchCode: '123456', accountNumber: '012345678901' } } };
  vi.mocked(apiClient.tagWithdrawals.list).mockImplementation(async (_search, status, pageNumber) => {
    const items = !status || row.status === status ? [row] : [];
    return { items, total: items.length, page: pageNumber };
  });
  vi.mocked(apiClient.tagWithdrawals.detail).mockImplementation(async () => ({ ...row }));
  vi.mocked(apiClient.tagWithdrawals.decide).mockImplementation(async (_id, data) => {
    row = { ...row, status: data.status, processingBy: 'admin-1', paymentReference: data.paymentReference }; return row;
  });
});
afterEach(cleanup);
it('shows payment details on opening but requires processing, a reference and confirmation to mark paid', async () => {
  page(); fireEvent.click(await screen.findByRole('button', { name: 'Review' }));
  expect(await screen.findByText('012345678901')).toBeTruthy();
  expect(apiClient.tagWithdrawals.decide).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Confirm paid' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Start processing' }));
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
  await screen.findByText(/Another person is processing/);
  expect(screen.queryByRole('button', { name: 'Confirm paid' })).toBeNull();
  expect(await screen.findByText('012345678901')).toBeTruthy();
});
it('shows load failures instead of an empty queue', async () => {
  vi.mocked(apiClient.tagWithdrawals.list).mockRejectedValue(new Error('Service unavailable'));
  page(); expect((await screen.findByRole('alert')).textContent).toContain('Service unavailable');
  expect(screen.queryByText('No withdrawal requests match these filters.')).toBeNull();
});

it('starts on All and keeps a request in the list after processing begins', async () => {
  page();
  expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['All', 'Requested', 'Payment in progress', 'Paid', 'Rejected']);
  expect(screen.getByRole('tab', { name: 'All', selected: true })).toBeTruthy();
  fireEvent.click(await screen.findByRole('button', { name: 'Review' }));
  expect(apiClient.tagWithdrawals.list).toHaveBeenCalledWith('', '', 1, undefined);
  fireEvent.click(await screen.findByRole('button', { name: 'Start processing' }));
  await screen.findByRole('heading', { name: 'Confirm completed payment' });
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  await screen.findByRole('button', { name: 'Review' });
  expect(screen.getByRole('cell', { name: 'Payment in progress' })).toBeTruthy();
  expect(screen.getByRole('tab', { name: 'All', selected: true })).toBeTruthy();
});

it('filters by each status tab and resets pagination when switching tabs', async () => {
  vi.mocked(apiClient.tagWithdrawals.list).mockResolvedValue({ items: [row], total: 30, page: 1 });
  page();
  fireEvent.click(await screen.findByRole('button', { name: 'Review' }));
  await screen.findByRole('button', { name: 'Start processing' });
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await waitFor(() => expect(apiClient.tagWithdrawals.list).toHaveBeenLastCalledWith('', '', 2, undefined));
  for (const [label, status] of [['Requested', 'pending'], ['Payment in progress', 'processing'], ['Paid', 'paid'], ['Rejected', 'rejected'], ['All', '']]) {
    fireEvent.mouseDown(screen.getByRole('tab', { name: label }), { button: 0, ctrlKey: false });
    await waitFor(() => expect(apiClient.tagWithdrawals.list).toHaveBeenLastCalledWith('', status, 1, undefined));
  }
});

it('keeps financial staff read-only without payout actions or payment details', async () => {
  auth.user = { _id: 'organizer-1', isSuperAdmin: false, permissions: ['tickets:view_revenue'], userType: 'sub-user' };
  page(); fireEvent.click(await screen.findByRole('button', { name: 'View' }));
  await screen.findByText('View the request status and payment history.');
  expect(screen.queryByRole('button', { name: 'Start processing' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Reject and release balance' })).toBeNull();
  expect(screen.queryByText('012345678901')).toBeNull();
  expect(apiClient.tagWithdrawals.decide).not.toHaveBeenCalled();
});

it('does not fetch requests for accounts without financial permission', async () => {
  auth.user = { _id: 'scanner-1', isSuperAdmin: false, permissions: ['tickets:scan_tickets'], userType: 'sub-user' };
  page();
  expect(apiClient.tagWithdrawals.list).not.toHaveBeenCalled();
  expect(screen.queryByRole('heading', { name: 'Tag withdrawals' })).toBeNull();
});

it('opens the request from anywhere on the tile and supports the keyboard', async () => {
  page();
  fireEvent.click(await screen.findByText('Festival'));
  await screen.findByRole('dialog', { name: 'Attendee withdrawal' });
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  const tile = screen.getByText('Festival').closest('tr')!;
  fireEvent.keyDown(tile, { key: 'Enter' });
  await screen.findByRole('dialog', { name: 'Attendee withdrawal' });
  expect(apiClient.tagWithdrawals.decide).not.toHaveBeenCalled();
});

it('waits for typing to pause, sends only the final search, and resets the page in that request', async () => {
  vi.mocked(apiClient.tagWithdrawals.list).mockResolvedValue({ items: [row], total: 30, page: 1 });
  page(); await screen.findByRole('button', { name: 'Review' });
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await waitFor(() => expect(apiClient.tagWithdrawals.list).toHaveBeenLastCalledWith('', '', 2, undefined));
  const count = vi.mocked(apiClient.tagWithdrawals.list).mock.calls.length;
  vi.useFakeTimers();
  try {
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'F' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'Festival' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(349); });
    expect(apiClient.tagWithdrawals.list).toHaveBeenCalledTimes(count);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(apiClient.tagWithdrawals.list).toHaveBeenCalledTimes(count + 1);
    expect(apiClient.tagWithdrawals.list).toHaveBeenLastCalledWith('Festival', '', 1, undefined);
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: '' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(350); });
    expect(apiClient.tagWithdrawals.list).toHaveBeenLastCalledWith('', '', 1, undefined);
  } finally { vi.useRealTimers(); }
});

it('searches events on the backend and sends the selected event filter with the list request', async () => {
  page(); await screen.findByRole('button', { name: 'Review' });
  fireEvent.click(screen.getByRole('combobox'));
  fireEvent.change(screen.getByPlaceholderText('Search events by name…'), { target: { value: 'Fest' } });
  await waitFor(() => expect(apiClient.tagWithdrawals.events).toHaveBeenCalledWith('Fest'));
  fireEvent.click(await screen.findByRole('option', { name: 'Festival' }));
  await waitFor(() => expect(apiClient.tagWithdrawals.list).toHaveBeenLastCalledWith('', '', 1, 'event-1'));
  expect(screen.getByRole('combobox').textContent).toContain('Festival');
  fireEvent.click(screen.getByRole('combobox'));
  fireEvent.click(screen.getByRole('option', { name: 'All events' }));
  await waitFor(() => expect(apiClient.tagWithdrawals.list).toHaveBeenLastCalledWith('', '', 1, undefined));
});

it('shows an event lookup failure instead of an empty event filter', async () => {
  vi.mocked(apiClient.tagWithdrawals.events).mockRejectedValue(new Error('Event lookup unavailable'));
  page(); await screen.findByRole('button', { name: 'Review' });
  fireEvent.click(screen.getByRole('combobox'));
  expect((await screen.findByRole('alert')).textContent).toContain('Event lookup unavailable');
  expect(screen.queryByText('No events found')).toBeNull();
});


it.each(['bank_transfer', 'mobile_money'] as const)('shows the event owner full %s details on opening and keeps them when processing/reopening', async method => {
  auth.user = { _id: 'organizer-1', isSuperAdmin: false, permissions: ['tickets:view_revenue'], userType: 'vendor' };
  const paymentDetail = method === 'bank_transfer' ? '012345678901' : '+26878422613';
  if (method === 'mobile_money') row = { ...row, method, country: 'SZ', details: { fullName: 'Attendee', contactPhone: '+26879990000', mobileNumber: paymentDetail, provider: 'MTN MoMo' } };
  vi.mocked(apiClient.tagWithdrawals.decide).mockImplementation(async (_id, data) => {
    row = { ...row, status: data.status, processingBy: 'organizer-1', paymentReference: data.paymentReference }; return row;
  });
  page(); fireEvent.click(await screen.findByRole('button', { name: 'Review' }));
  expect(await screen.findByText(paymentDetail)).toBeTruthy();
  expect(apiClient.tagWithdrawals.decide).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Confirm paid' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Start processing' }));
  await screen.findByRole('heading', { name: 'Confirm completed payment' });
  expect(screen.getByText(paymentDetail)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  fireEvent.click(screen.getByRole('button', { name: 'Review' }));
  expect(await screen.findByText(paymentDetail)).toBeTruthy();
  const confirm = screen.getByRole('button', { name: 'Confirm paid' }) as HTMLButtonElement;
  expect(confirm.disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('Payment reference'), { target: { value: 'OWNER-123' } });
  fireEvent.click(screen.getByRole('checkbox', { name: 'I have sent this payment and confirmed it completed.' }));
  fireEvent.click(confirm);
  await waitFor(() => expect(apiClient.tagWithdrawals.decide).toHaveBeenLastCalledWith('request-1', { status: 'paid', paymentReference: 'OWNER-123', paymentCompleted: true }));
});

it('prevents an organizer from paying a request already claimed by someone else', async () => {
  auth.user = { _id: 'organizer-1', isSuperAdmin: false, permissions: ['tickets:view_revenue'], userType: 'vendor' };
  row = { ...row, status: 'processing', processingBy: 'another-person' };
  page(); fireEvent.click(await screen.findByRole('button', { name: 'Review' }));
  await screen.findByText(/Another person is processing/);
  expect(screen.queryByRole('button', { name: 'Confirm paid' })).toBeNull();
  expect(await screen.findByText('012345678901')).toBeTruthy();
});
