// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { EventCashlessTab } from '@/components/EventCashlessTab';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    apiClient: {
      events: { getEventCashlessSummary: vi.fn().mockResolvedValue({}) },
    },
  };
});

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { isSuperAdmin: true, permissions: [] } }),
}));

afterEach(cleanup);

const renderTab = (initialEntry = '/events/e1') =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <EventCashlessTab eventId="e1" />
      </QueryClientProvider>
    </MemoryRouter>,
  );

describe('cashless tab labels', () => {
  it('labels the transaction report Transactions, not Money', () => {
    renderTab();
    expect(screen.getByRole('tab', { name: 'Transactions' })).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'Money' })).toBeNull();
  });

  it('still selects that tab from an existing ?sub=money deep link', () => {
    renderTab('/events/e1?sub=money');
    // The URL key is unchanged — only the label moved. An organizer's saved
    // link must keep landing on the same pane.
    expect(screen.getByRole('tab', { name: 'Transactions' }).getAttribute('data-state')).toBe('active');
  });
});
