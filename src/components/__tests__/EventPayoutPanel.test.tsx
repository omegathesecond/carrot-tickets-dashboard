// @vitest-environment jsdom
import { it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EventPayoutPanel } from '../EventPayoutPanel';
import { OrganizerPayoutsPage } from '@/pages/OrganizerPayoutsPage';
import { apiClient } from '@/lib/api';
import type {
  EventPayoutOverview,
  EventPayoutRequest,
  PayoutBank,
} from '@/types/eventPayout';

vi.mock('@/lib/api', () => ({
  apiClient: {
    payoutRequests: {
      overview: vi.fn(),
      bank: vi.fn(),
      request: vi.fn(),
      forgetBank: vi.fn(),
      list: vi.fn(),
      detail: vi.fn(),
      decide: vi.fn(),
    },
  },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const bank: PayoutBank = {
  country: 'Eswatini',
  bank: 'Local Bank',
  accountType: 'Current',
  branchCode: '123456',
  accountHolder: 'Organizer',
  accountNumber: '012345678901',
};
const breakdown = {
  sales: 1,
  gross: 100,
  refunds: 0,
  platformFees: 10,
  resellerCommission: 0,
  absorbedFees: 0,
  organizerProceeds: 90,
  vendorHeld: 0,
  unremitted: 0,
  vendorFees: 0,
  adjustments: 0,
  previouslyPaid: 0,
  availableBalance: 90,
};
const overview: EventPayoutOverview = {
  eventId: 'e1',
  eventName: 'Festival',
  eventDate: '2020-01-01',
  currency: 'SZL',
  eligible: true,
  reason: null,
  breakdown,
  requests: [],
};
const payout: EventPayoutRequest = {
  _id: 'p1',
  eventId: 'e1',
  vendorId: 'v1',
  eventName: 'Festival',
  eventDate: '2020-01-01',
  organizerName: 'Organizer',
  currency: 'SZL',
  amount: 90,
  breakdown,
  bank: { ...bank, accountNumber: '••••8901' },
  status: 'pending',
  createdAt: '2020-01-02',
  history: [{ status: 'pending', at: '2020-01-02', by: 'v1' }],
};
function show(admin = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const view = render(
    <QueryClientProvider client={client}>
      {admin ? <OrganizerPayoutsPage /> : <EventPayoutPanel eventId="e1" />}
    </QueryClientProvider>,
  );
  return { ...view, client };
}
beforeEach(() => {
  vi.mocked(apiClient.payoutRequests.overview).mockResolvedValue(overview);
  vi.mocked(apiClient.payoutRequests.bank).mockResolvedValue(null);
  vi.mocked(apiClient.payoutRequests.request).mockResolvedValue(payout);
  vi.mocked(apiClient.payoutRequests.list).mockResolvedValue({
    items: [payout],
    total: 1,
    page: 1,
  });
  vi.mocked(apiClient.payoutRequests.detail).mockResolvedValue({
    ...payout,
    bank,
    currentBreakdown: breakdown,
  });
  vi.mocked(apiClient.payoutRequests.decide).mockResolvedValue(payout);
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it('disables ineligible events and explains why', async () => {
  vi.mocked(apiClient.payoutRequests.overview).mockResolvedValue({
    ...overview,
    eligible: false,
    reason: 'Payouts open after the event ends',
  });
  show();
  expect(
    (
      (await screen.findByRole('button', {
        name: 'Request Payout',
      })) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  expect(screen.getByText('Payouts open after the event ends')).toBeTruthy();
});
it('surfaces a balance error instead of showing a successful empty balance', async () => {
  vi.mocked(apiClient.payoutRequests.overview).mockRejectedValue(
    new Error('Ledger unavailable'),
  );
  show();
  expect((await screen.findByRole('alert')).textContent).toContain(
    'Ledger unavailable',
  );
  expect(screen.queryByRole('button', { name: 'Request Payout' })).toBeNull();
});
it('requires bank fields then masks confirmation before submitting and saving', async () => {
  show();
  fireEvent.click(
    await screen.findByRole('button', { name: 'Request Payout' }),
  );
  await screen.findByLabelText('Account number');
  const labels: Record<string, string> = {
    country: 'Country',
    bank: 'Bank',
    accountType: 'Account type',
    branchCode: 'Branch code',
    accountHolder: 'Account holder name',
    accountNumber: 'Account number',
  };
  const account = screen.getByLabelText('Account number') as HTMLInputElement;
  expect(account.required).toBe(true);
  Object.entries(labels).forEach(([key, label]) =>
    fireEvent.change(screen.getByLabelText(label), {
      target: { value: bank[key as keyof PayoutBank] },
    }),
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Review masked account' }),
  );
  expect(await screen.findByText('••••8901')).toBeTruthy();
  expect(screen.queryByDisplayValue(bank.accountNumber)).toBeNull();
  expect(apiClient.payoutRequests.request).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole('button', { name: 'Submit payout request' }),
  );
  await waitFor(() =>
    expect(apiClient.payoutRequests.request).toHaveBeenCalledWith('e1', {
      bank,
      saveBank: true,
      expectedAmount: 90,
    }),
  );
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
});
it('reuses only masked saved details with an explicit version', async () => {
  vi.mocked(apiClient.payoutRequests.bank).mockResolvedValue({
    ...bank,
    accountNumber: '••••8901',
    version: 'v2',
  });
  show();
  fireEvent.click(
    await screen.findByRole('button', { name: 'Request Payout' }),
  );
  await screen.findByLabelText('Reuse saved bank details');
  expect(screen.queryByLabelText('Account number')).toBeNull();
  fireEvent.click(
    screen.getByRole('button', { name: 'Review masked account' }),
  );
  fireEvent.click(
    await screen.findByRole('button', { name: 'Submit payout request' }),
  );
  await waitFor(() =>
    expect(apiClient.payoutRequests.request).toHaveBeenCalledWith('e1', {
      useSaved: true,
      bankVersion: 'v2',
      expectedAmount: 90,
    }),
  );
});
it('shows saved-bank dependency failures and prevents proceeding', async () => {
  vi.mocked(apiClient.payoutRequests.bank).mockRejectedValue(
    new Error('Unavailable'),
  );
  show();
  fireEvent.click(
    await screen.findByRole('button', { name: 'Request Payout' }),
  );
  expect((await screen.findByRole('alert')).textContent).toContain(
    'Could not load saved bank details',
  );
  expect(
    screen.queryByRole('button', { name: 'Review masked account' }),
  ).toBeNull();
});
it('loads confidential details only after admin opens review and records approval', async () => {
  show(true);
  expect(apiClient.payoutRequests.detail).not.toHaveBeenCalled();
  fireEvent.click(await screen.findByRole('button', { name: 'Review' }));
  const dialog = await screen.findByRole('dialog');
  expect(await within(dialog).findByText(bank.accountNumber)).toBeTruthy();
  fireEvent.change(
    within(dialog).getByLabelText('Note to organizer (optional)'),
    { target: { value: 'Checked sales' } },
  );
  fireEvent.click(within(dialog).getByRole('button', { name: 'Approve' }));
  await waitFor(() =>
    expect(apiClient.payoutRequests.decide).toHaveBeenCalledWith('p1', {
      status: 'approved',
      note: 'Checked sales',
    }),
  );
});
it('requires completed payment, reference and date before marking approved requests paid', async () => {
  vi.mocked(apiClient.payoutRequests.detail).mockResolvedValue({
    ...payout,
    status: 'approved',
    bank,
  });
  show(true);
  fireEvent.click(await screen.findByRole('button', { name: 'Review' }));
  const paid = (await screen.findByRole('button', {
    name: 'Mark Paid',
  })) as HTMLButtonElement;
  expect(paid.disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('Payment completed at'), {
    target: { value: '2026-01-02T10:00' },
  });
  fireEvent.change(screen.getByLabelText('Payment reference'), {
    target: { value: 'EFT-1' },
  });
  fireEvent.click(
    screen.getByLabelText('I confirm this payment has completed.'),
  );
  fireEvent.click(paid);
  await waitFor(() =>
    expect(apiClient.payoutRequests.decide).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({
        status: 'paid',
        paymentReference: 'EFT-1',
        paymentCompleted: true,
      }),
    ),
  );
});
it('applies search and status filters to the admin request list', async () => {
  show(true);
  await screen.findByRole('button', { name: 'Review' });
  fireEvent.change(screen.getByLabelText('Search'), {
    target: { value: 'Festival' },
  });
  fireEvent.change(screen.getByLabelText('Status'), {
    target: { value: 'declined' },
  });
  await waitFor(() =>
    expect(apiClient.payoutRequests.list).toHaveBeenCalledWith(
      'Festival',
      'declined',
      1,
    ),
  );
});

it('keeps the confirmed amount and bank version fixed while background data changes', async () => {
  vi.mocked(apiClient.payoutRequests.bank).mockResolvedValue({
    ...bank,
    accountNumber: '••••8901',
    version: 'v2',
  });
  const { client } = show();
  fireEvent.click(
    await screen.findByRole('button', { name: 'Request Payout' }),
  );
  await screen.findByLabelText('Reuse saved bank details');
  fireEvent.click(
    screen.getByRole('button', { name: 'Review masked account' }),
  );
  await screen.findByRole('button', { name: 'Submit payout request' });
  client.setQueryData(['event-payout', 'e1'], {
    ...overview,
    breakdown: { ...breakdown, availableBalance: 200 },
  });
  client.setQueryData(['payout-bank'], {
    ...bank,
    accountNumber: '••••9999',
    version: 'v3',
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Submit payout request' }),
  );
  await waitFor(() =>
    expect(apiClient.payoutRequests.request).toHaveBeenCalledWith('e1', {
      useSaved: true,
      bankVersion: 'v2',
      expectedAmount: 90,
    }),
  );
});
it('shows a live balance error while keeping the decline action and audit history available', async () => {
  vi.mocked(apiClient.payoutRequests.detail).mockResolvedValue({
    ...payout,
    bank,
    balanceError: 'Event not found',
  });
  show(true);
  fireEvent.click(await screen.findByRole('button', { name: 'Review' }));
  expect((await screen.findByRole('alert')).textContent).toContain(
    'Event not found',
  );
  expect(
    (screen.getByRole('button', { name: 'Approve' }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
  await waitFor(() =>
    expect(apiClient.payoutRequests.decide).toHaveBeenCalledWith('p1', {
      status: 'declined',
      note: '',
    }),
  );
});
