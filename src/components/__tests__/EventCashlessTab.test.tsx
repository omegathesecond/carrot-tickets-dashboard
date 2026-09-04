// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { EventCashlessTab } from '@/components/EventCashlessTab';
import type { AuthUser } from '@/types';

afterEach(cleanup);

// The panes themselves are exercised through the API; this suite is about which
// of them the tab offers, and which one it opens for a given URL.
vi.mock('@/components/EventStockReport', () => ({
  EventStockReport: () => <div>stock-report-pane</div>,
}));
vi.mock('@/components/cashless/EventStallsPanel', () => ({
  EventStallsPanel: () => <div>stalls-pane</div>,
}));
vi.mock('@/components/cashless/EventCataloguePanel', () => ({
  EventCataloguePanel: () => <div>catalogue-pane</div>,
}));
vi.mock('@/components/CashiersPanel', () => ({
  CashiersPanel: () => <div>cashiers-pane</div>,
}));
vi.mock('@/components/cashless/EventTagsPanel', () => ({
  EventTagsPanel: () => <div>balances-pane</div>,
}));
vi.mock('@/components/cashless/EventRegisterPanel', () => ({
  EventRegisterPanel: () => <div>register-pane</div>,
}));
vi.mock('@/components/cashless/EventTransactionLog', () => ({
  EventTransactionLog: () => <div>transaction-log-pane</div>,
}));
// Rejects by default (the "not cashless" path most of these cases exercise);
// the Money-pane suite resolves it to a real summary instead.
const summary = vi.fn<() => Promise<unknown>>(() => Promise.reject(new Error('not cashless')));
vi.mock('@/lib/api', () => ({
  apiClient: {
    events: {
      getEventCashlessSummary: () => summary(),
      getEventCashlessTransactions: vi.fn(async () => ({ transactions: [], hasMore: false })),
    },
  },
}));

const authUser = vi.fn<() => AuthUser | null>(() => null);
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: authUser() }) }));

// Super-admins clear every gate. A restricted team member needs a NON-empty
// permissions array: hasPermission reads an empty one as "owner, full access",
// so `permissions: []` would grant both tabs rather than deny them.
const SUPER_ADMIN = { isSuperAdmin: true } as unknown as AuthUser;
const RESTRICTED = { permissions: ['tickets:view_sales'] } as unknown as AuthUser;

function renderTab(user: AuthUser | null, url = '/events/e1') {
  authUser.mockReturnValue(user);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <EventCashlessTab eventId="e1" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('EventCashlessTab sub-tabs', () => {
  it('offers Stalls, Catalogue and Cashiers to a user who can manage them', () => {
    renderTab(SUPER_ADMIN);
    expect(screen.getByRole('tab', { name: 'Stalls' })).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Catalogue' })).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Cashiers' })).toBeDefined();
  });

  it('hides all three management tabs from a restricted team member', () => {
    renderTab(RESTRICTED);
    expect(screen.queryByRole('tab', { name: 'Stalls' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Catalogue' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Cashiers' })).toBeNull();
    expect(screen.getByRole('tab', { name: 'Money' })).toBeDefined();
  });

  it('opens the sub-tab named in the URL', () => {
    renderTab(SUPER_ADMIN, '/events/e1?tab=cashless&sub=stalls');
    expect(screen.getByText('stalls-pane')).toBeDefined();
  });

  it('opens the Cashiers sub-tab named in the URL', () => {
    renderTab(SUPER_ADMIN, '/events/e1?tab=cashless&sub=cashiers');
    expect(screen.getByText('cashiers-pane')).toBeDefined();
  });

  it('falls back to Money when the URL names a sub-tab the user cannot see', () => {
    renderTab(RESTRICTED, '/events/e1?tab=cashless&sub=catalogue');
    // Not an empty pane: the Money tab is selected instead.
    expect(screen.queryByText('catalogue-pane')).toBeNull();
    expect(screen.getByRole('tab', { name: 'Money' }).getAttribute('data-state')).toBe('active');
  });

  it('falls back to Money when the URL names cashiers and the user cannot see it', () => {
    renderTab(RESTRICTED, '/events/e1?tab=cashless&sub=cashiers');
    expect(screen.queryByText('cashiers-pane')).toBeNull();
    expect(screen.getByRole('tab', { name: 'Money' }).getAttribute('data-state')).toBe('active');
  });

  it('offers Register to a user who can manage access', () => {
    renderTab(SUPER_ADMIN);
    expect(screen.getByRole('tab', { name: 'Register' })).toBeDefined();
  });

  it('hides Register from a restricted team member', () => {
    renderTab(RESTRICTED);
    expect(screen.queryByRole('tab', { name: 'Register' })).toBeNull();
  });

  it('opens the Register sub-tab named in the URL', () => {
    renderTab(SUPER_ADMIN, '/events/e1?tab=cashless&sub=register');
    expect(screen.getByText('register-pane')).toBeDefined();
  });
});

// The Money pane only renders its inner tabs once the summary has loaded — an
// event that is not cashless has no money to break down.
describe('EventCashlessTab Money panes', () => {
  function renderLoaded(url = '/events/e1') {
    authUser.mockReturnValue(SUPER_ADMIN);
    summary.mockResolvedValue({
      circulated: 164000, spent: 24200, withdrawn: 4000, leftBehind: 135800,
      fees: 450, walletsFunded: 5, vendors: [], cashiers: [],
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[url]}>
          <EventCashlessTab eventId="e1" />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  it('breaks Money down into the four questions it answers', async () => {
    renderLoaded();
    expect(await screen.findByRole('tab', { name: 'Transaction log' })).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Cashier activity' })).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Stall takings' })).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Balances' })).toBeDefined();
  });

  it('opens the transaction log first', async () => {
    renderLoaded();
    expect(await screen.findByText('transaction-log-pane')).toBeDefined();
  });

  it('opens the pane named in the URL', async () => {
    renderLoaded('/events/e1?tab=cashless&sub=money&pane=balances');
    expect(await screen.findByText('balances-pane')).toBeDefined();
  });

  it('lands an old ?sub=tags link on Balances, where tags now live', async () => {
    renderLoaded('/events/e1?tab=cashless&sub=tags');
    expect(await screen.findByText('balances-pane')).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Money' }).getAttribute('data-state')).toBe('active');
  });
});
