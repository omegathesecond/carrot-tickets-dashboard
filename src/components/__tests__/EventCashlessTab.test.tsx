// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { EventCashlessTab } from '@/components/EventCashlessTab';
import type { AuthUser } from '@/types';

afterEach(cleanup);

// The panes themselves are exercised through the API; this suite is about which
// of them the tab offers, which main tab each lives under, and which one opens
// for a given URL.
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
vi.mock('@/components/cashless/EventTagRegisterPanel', () => ({
  EventTagRegisterPanel: () => <div>tags-pane</div>,
}));
vi.mock('@/components/cashless/EventTransactionLog', () => ({
  EventTransactionLog: () => <div>transaction-log-pane</div>,
}));
// Rejects by default (the "not cashless" path most of these cases exercise);
// the loaded-summary suite resolves it to a real summary instead.
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
// Hires the desk but may not fill the tag box — the two are separate
// capabilities server-side (MANAGE_ACCESS vs ISSUE_TAGS).
const DESK_MANAGER = { permissions: ['tickets:manage_access'] } as unknown as AuthUser;

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

describe('EventCashlessTab main tabs', () => {
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

  it('offers Balances to everyone, restricted or not', () => {
    renderTab(RESTRICTED);
    expect(screen.getByRole('tab', { name: 'Balances' })).toBeDefined();
  });

  it('no longer offers a top-level Stock tab — it now lives under Catalogue', () => {
    renderTab(SUPER_ADMIN);
    expect(screen.queryByRole('tab', { name: 'Stock' })).toBeNull();
  });

  it('opens the Cashiers sub-tab named in the URL', () => {
    renderTab(SUPER_ADMIN, '/events/e1?tab=cashless&sub=cashiers');
    expect(screen.getByRole('tab', { name: 'Cashier activity' })).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Add cashier' })).toBeDefined();
  });

  it('opens the Catalogue sub-tab named in the URL', () => {
    renderTab(SUPER_ADMIN, '/events/e1?tab=cashless&sub=catalogue');
    expect(screen.getByText('catalogue-pane')).toBeDefined();
  });

  it('opens the Balances sub-tab named in the URL', () => {
    renderTab(SUPER_ADMIN, '/events/e1?tab=cashless&sub=balances');
    expect(screen.getByText('balances-pane')).toBeDefined();
  });

  it('lands an old ?sub=tags link on Balances, where tags now live', () => {
    renderTab(SUPER_ADMIN, '/events/e1?tab=cashless&sub=tags');
    expect(screen.getByText('balances-pane')).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Balances' }).getAttribute('data-state')).toBe('active');
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

  it('opens the Register sub-tab named in the URL, on Registered tags by default', async () => {
    renderTab(SUPER_ADMIN, '/events/e1?tab=cashless&sub=register');
    expect(await screen.findByText('tags-pane')).toBeDefined();
    expect(screen.queryByText('register-pane')).toBeNull();
  });
});

describe('EventCashlessTab Register tab', () => {
  it('opens on Registered tags, with Add account alongside it', async () => {
    renderTab(SUPER_ADMIN, '/events/e1?tab=cashless&sub=register');
    expect(await screen.findByRole('tab', { name: 'Registered tags' })).toBeDefined();
    const addAccount = screen.getByRole('tab', { name: 'Add account' });
    expect(addAccount).toBeDefined();
    expect(screen.queryByText('register-pane')).toBeNull();

    // Radix Tabs selects on mousedown, not click.
    fireEvent.mouseDown(addAccount, { button: 0 });
    expect(await screen.findByText('register-pane')).toBeDefined();
  });

  it('hides the tag box from a member who may hire the desk but not issue tags', async () => {
    // The API answers this person's tag-register call with a 403, so offering
    // the pane could only ever produce "Could not load the tag register".
    renderTab(DESK_MANAGER, '/events/e1?tab=cashless&sub=register');

    expect(await screen.findByRole('tab', { name: 'Add account' })).toBeDefined();
    expect(screen.queryByRole('tab', { name: 'Registered tags' })).toBeNull();
    expect(screen.queryByText('tags-pane')).toBeNull();
    // …and the pane they CAN use opens instead of an empty tab.
    expect(await screen.findByText('register-pane')).toBeDefined();
  });
});

describe('EventCashlessTab Stalls tab', () => {
  it('opens on Stall takings, with Add stall alongside it', async () => {
    renderTab(SUPER_ADMIN, '/events/e1?tab=cashless&sub=stalls');
    expect(await screen.findByRole('tab', { name: 'Stall takings' })).toBeDefined();
    const addStall = screen.getByRole('tab', { name: 'Add stall' });
    expect(addStall).toBeDefined();
    expect(screen.queryByText('stalls-pane')).toBeNull();

    // Radix Tabs selects on mousedown, not click.
    fireEvent.mouseDown(addStall, { button: 0 });
    expect(await screen.findByText('stalls-pane')).toBeDefined();
  });
});

describe('EventCashlessTab Cashiers tab', () => {
  it('opens on Cashier activity, with Add cashier alongside it', async () => {
    renderTab(SUPER_ADMIN, '/events/e1?tab=cashless&sub=cashiers');
    expect(await screen.findByRole('tab', { name: 'Cashier activity' })).toBeDefined();
    const addCashier = screen.getByRole('tab', { name: 'Add cashier' });
    expect(addCashier).toBeDefined();
    expect(screen.queryByText('cashiers-pane')).toBeNull();

    // Radix Tabs selects on mousedown, not click.
    fireEvent.mouseDown(addCashier, { button: 0 });
    expect(await screen.findByText('cashiers-pane')).toBeDefined();
  });
});

// The Money tab, and the Stalls/Cashiers activity panes, only render their
// real content once the summary has loaded — an event that is not cashless
// has no money to break down.
describe('EventCashlessTab once the summary has loaded', () => {
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

  it('Money shows the totals and the transaction log directly, no inner tabs', async () => {
    renderLoaded();
    expect(await screen.findByText('transaction-log-pane')).toBeDefined();
    // Cashier activity and Stall takings used to be inner Money tabs; they now
    // live under Cashiers and Stalls instead.
    expect(screen.queryByRole('tab', { name: 'Cashier activity' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Stall takings' })).toBeNull();
  });

  it('Stall takings breaks down what each stall took', async () => {
    renderLoaded('/events/e1?tab=cashless&sub=stalls');
    expect(await screen.findByText('No stall charges yet.')).toBeDefined();
  });

  it('Cashier activity breaks down what each cashier moved', async () => {
    renderLoaded('/events/e1?tab=cashless&sub=cashiers');
    expect(await screen.findByText('No cashier activity yet.')).toBeDefined();
  });
});
