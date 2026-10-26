// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MarketplacePage } from '@/pages/MarketplacePage';
import { newOpportunity } from '@/lib/marketplace';
import type { MarketOptions } from '@/types/marketplace';

const { marketplace } = vi.hoisted(() => ({ marketplace: vi.fn() }));
vi.mock('@/lib/api', () => ({ apiClient: { marketplace } }));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { userType: 'vendor' } }),
}));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it('preserves the linked event and poster when editing an opportunity from the website', async () => {
  const options: MarketOptions = {
    marketTypes: ['Weekly Markets'], availability: [], certificateTypes: [], regions: {},
  };
  const opportunity = {
    ...newOpportunity(options),
    _id: '111111111111111111111111', organiser: 'City Markets', name: 'Summer market',
    location: 'Mbabane', description: 'Local makers', dates: ['2099-11-18'],
    applicationDeadline: '2099-11-10T12:00:00.000Z', paymentDeadline: '2099-11-12T12:00:00.000Z',
    cancellationTerms: 'Refund before deadline',
    eventId: '222222222222222222222222', posterUrl: 'https://example.com/poster.png',
  };
  marketplace.mockImplementation(async (path: string, init?: RequestInit) => {
    if (init) return opportunity;
    if (path === '/options') return options;
    return { items: [opportunity] };
  });
  render(<MarketplacePage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
  fireEvent.change(screen.getByLabelText('Market name'), { target: { value: 'Updated market' } });
  fireEvent.submit(screen.getByLabelText('Market name').closest('form')!);
  await waitFor(() => expect(marketplace).toHaveBeenCalledWith(
    '/manage/opportunities/' + opportunity._id,
    expect.objectContaining({ method: 'PUT' }),
  ));
  const call = marketplace.mock.calls.find(([, init]) => init?.method === 'PUT')!;
  const payload = JSON.parse(call[1].body);
  expect(payload).toMatchObject({
    name: 'Updated market', eventId: opportunity.eventId, posterUrl: opportunity.posterUrl,
  });
  expect(payload).not.toHaveProperty('_id');
  expect(payload).not.toHaveProperty('organiser');
  expect(payload).not.toHaveProperty('status');
});
