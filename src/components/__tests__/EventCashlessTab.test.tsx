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
vi.mock('@/lib/api', () => ({
  apiClient: {
    events: {
      getEventCashlessSummary: vi.fn(async () => {
        throw new Error('not cashless');
      }),
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
  it('offers Stalls and Catalogue to a user who can manage them', () => {
    renderTab(SUPER_ADMIN);
    expect(screen.getByRole('tab', { name: 'Stalls' })).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Catalogue' })).toBeDefined();
  });

  it('hides both management tabs from a restricted team member', () => {
    renderTab(RESTRICTED);
    expect(screen.queryByRole('tab', { name: 'Stalls' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Catalogue' })).toBeNull();
    expect(screen.getByRole('tab', { name: 'Money' })).toBeDefined();
  });

  it('opens the sub-tab named in the URL', () => {
    renderTab(SUPER_ADMIN, '/events/e1?tab=cashless&sub=stalls');
    expect(screen.getByText('stalls-pane')).toBeDefined();
  });

  it('falls back to Money when the URL names a sub-tab the user cannot see', () => {
    renderTab(RESTRICTED, '/events/e1?tab=cashless&sub=catalogue');
    // Not an empty pane: the Money tab is selected instead.
    expect(screen.queryByText('catalogue-pane')).toBeNull();
    expect(screen.getByRole('tab', { name: 'Money' }).getAttribute('data-state')).toBe('active');
  });
});
