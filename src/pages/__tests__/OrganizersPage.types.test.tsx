// @vitest-environment jsdom
//
// The Organizers page is split into account-type tabs, one table shape per
// tab, and every filter is applied by the server. Native matchers only: this
// repo has no jest-dom.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { OrganizersPage } from '@/pages/OrganizersPage';
import { apiClient } from '@/lib/api';
import { formatCurrency } from '@/lib/chartColors';
import type { Organizer, OrganizersListParams, OrganizersListResponse } from '@/types';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/api', () => ({
  apiClient: {
    organizers: {
      list: vi.fn(),
      updateVerification: vi.fn(),
      create: vi.fn(),
      activateVenue: vi.fn(),
      setVenueStatus: vi.fn(),
    },
  },
}));

const list = apiClient.organizers.list as unknown as ReturnType<typeof vi.fn>;

const base: Organizer = {
  id: 'org', businessName: 'Org', email: 'org@example.com', phoneNumber: null, primaryContact: 'Jane Dlamini',
  businessType: null, operatorType: 'events', verificationStatus: 'verified', verifiedAt: null, rejectionReason: null,
  isActive: true, createdAt: '2026-09-01T12:00:00.000Z', eventCount: 0, ticketsSold: 0, revenue: 0, venue: null,
  type: 'events',
};
const org = (o: Partial<Organizer>): Organizer => ({ ...base, ...o });

const eventsOrg = org({ id: 'e1', businessName: 'Sunshine Events', eventCount: 4, ticketsSold: 120, revenue: 6000 });
const busOrg = org({ id: 'e2', businessName: 'Both Ways Travel', operatorType: 'both' });
const venueNone = org({ id: 'v-none', businessName: 'Dry Lounge', type: 'venues', businessType: 'venue' });
const venueOn = org({
  id: 'v-on', businessName: 'Kwa-Linda Lounge', type: 'venues', businessType: 'venue',
  venue: { id: 'ven-1', name: 'Kwa-Linda Rooftop', currency: 'ZAR', status: 'active', activatedAt: '2026-10-01T12:00:00.000Z' },
});
const venueSuspended = org({
  id: 'v-sus', businessName: 'Closed Cellar', type: 'venues', businessType: 'venue',
  venue: { id: 'ven-2', name: 'Cellar Bar', currency: 'SZL', status: 'suspended', activatedAt: '2026-09-15T12:00:00.000Z' },
});
// A venue-type account that is also a bus operator: the API never grants it the venue permission.
const venueTransport = org({ id: 'v-bus', businessName: 'Rolling Bar', type: 'venues', businessType: 'venue', operatorType: 'transport' });
const glowSpa = org({
  id: 's1', businessName: 'Glow Spa', type: 'services', operatorType: 'services', serviceCategory: 'beauty_and_wellness',
});
const coaches = org({ id: 't1', businessName: 'Sunshine Coaches', type: 'transport', operatorType: 'transport' });

const COUNTS = { all: 30, events: 10, venues: 12, services: 5, transport: 3 };

function respond(organizers: Organizer[], extra: Partial<OrganizersListResponse> = {}): OrganizersListResponse {
  return {
    organizers,
    statusCounts: { pending: 2, verified: 7, rejected: 1, suspended: 2 },
    typeCounts: COUNTS,
    serviceCategories: ['beauty_and_wellness', 'food_and_drink'],
    pagination: { page: 1, limit: 25, total: organizers.length, totalPages: 1 },
    ...extra,
  };
}

/** A 3-page result set whose pagination echoes the page that was asked for. */
function threePages(organizers: Organizer[]) {
  list.mockImplementation(async (p: OrganizersListParams) =>
    respond(organizers, { pagination: { page: p.page ?? 1, limit: 25, total: 60, totalPages: 3 } }));
}

let navigateTo: (to: string) => void;
function UrlProbe() {
  const location = useLocation();
  navigateTo = useNavigate();
  return <div data-testid="url">{location.pathname + location.search}</div>;
}

function renderPage(path = '/organizers') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <OrganizersPage />
        <UrlProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const url = () => screen.getByTestId('url').textContent;
const lastParams = (): OrganizersListParams => list.mock.lastCall![0];
const headers = () => screen.getAllByRole('columnheader').map((h) => h.textContent);
const rowOf = (name: string) => within(screen.getByText(name).closest('tr')!);
// Radix's TabsTrigger selects on POINTER-DOWN, not click.
const openTab = (name: string | RegExp) => fireEvent.mouseDown(screen.getByRole('tab', { name }), { button: 0 });

beforeEach(() => {
  vi.clearAllMocks();
  list.mockResolvedValue(respond([eventsOrg, coaches]));
});
afterEach(cleanup);

describe('OrganizersPage — type tabs', () => {
  it('shows every tab with its count from typeCounts, All selected without a ?type param', async () => {
    renderPage();
    await screen.findByText('Sunshine Events');

    for (const name of ['All (30)', 'Event organizers (10)', 'Venues (12)', 'Businesses (5)', 'Bus operators (3)']) {
      expect(screen.getByRole('tab', { name })).toBeTruthy();
    }
    expect(screen.getByRole('tab', { name: 'All (30)' }).getAttribute('aria-selected')).toBe('true');
    expect(lastParams().type).toBeUndefined();
  });

  it('clicking Venues asks the server for type venues and puts ?type=venues in the URL', async () => {
    renderPage();
    await screen.findByText('Sunshine Events');

    openTab(/^Venues/);

    await waitFor(() => expect(lastParams().type).toBe('venues'));
    expect(url()).toBe('/organizers?type=venues');
    expect(screen.getByRole('tab', { name: 'Venues (12)' }).getAttribute('aria-selected')).toBe('true');
  });

  it('clicking All drops the ?type param again', async () => {
    renderPage('/organizers?type=venues');
    await screen.findByText('Sunshine Events');

    openTab(/^All/);

    await waitFor(() => expect(lastParams().type).toBeUndefined());
    expect(url()).toBe('/organizers');
  });

  it('opens the Businesses tab for /organizers?type=services', async () => {
    renderPage('/organizers?type=services');
    await screen.findByText('Sunshine Events');

    expect(screen.getByRole('tab', { name: 'Businesses (5)' }).getAttribute('aria-selected')).toBe('true');
    expect(lastParams().type).toBe('services');
  });

  it('treats an unknown ?type as the All tab rather than sending it to the API', async () => {
    renderPage('/organizers?type=bogus');
    await screen.findByText('Sunshine Events');

    expect(screen.getByRole('tab', { name: 'All (30)' }).getAttribute('aria-selected')).toBe('true');
    expect(lastParams().type).toBeUndefined();
  });
});

describe('OrganizersPage — columns per tab', () => {
  it.each([
    ['/organizers', ['Business', 'Type', 'Contact', 'Joined', 'Status', 'Actions']],
    ['/organizers?type=events', ['Business', 'Contact', 'Joined', 'Events', 'Tickets', 'Revenue', 'Status', 'Actions']],
    ['/organizers?type=venues', ['Business', 'Contact', 'Joined', 'Venue trading', 'Status', 'Actions']],
    ['/organizers?type=services', ['Business', 'Category', 'Contact', 'Joined', 'Status', 'Actions']],
    ['/organizers?type=transport', ['Business', 'Contact', 'Joined', 'Status', 'Actions']],
  ])('%s has exactly its own columns', async (path, expected) => {
    renderPage(path);
    await screen.findByText('Sunshine Events');
    expect(headers()).toEqual(expected);
  });

  it('the Venues tab has Venue trading and no Revenue column', async () => {
    renderPage('/organizers?type=venues');
    await screen.findByText('Sunshine Events');
    expect(screen.getByRole('columnheader', { name: 'Venue trading' })).toBeTruthy();
    expect(screen.queryByRole('columnheader', { name: 'Revenue' })).toBeNull();
  });

  it('the Event organizers tab shows each row\'s events, tickets and revenue', async () => {
    renderPage('/organizers?type=events');
    await screen.findByText('Sunshine Events');
    const row = rowOf('Sunshine Events');
    expect(row.getByText('4')).toBeTruthy();
    expect(row.getByText('120')).toBeTruthy();
    expect(row.getByText(formatCurrency(6000))).toBeTruthy();
  });

  it('the Businesses tab shows the humanised category', async () => {
    list.mockResolvedValue(respond([glowSpa]));
    renderPage('/organizers?type=services');
    await screen.findByText('Glow Spa');
    expect(rowOf('Glow Spa').getByText('Beauty And Wellness')).toBeTruthy();
  });

  it('the All tab labels each row with its type', async () => {
    list.mockResolvedValue(respond([eventsOrg, venueNone, glowSpa, coaches]));
    renderPage();
    await screen.findByText('Sunshine Events');
    expect(rowOf('Sunshine Events').getByText('Event organizer')).toBeTruthy();
    expect(rowOf('Dry Lounge').getByText('Venue')).toBeTruthy();
    expect(rowOf('Glow Spa').getByText('Business')).toBeTruthy();
    expect(rowOf('Sunshine Coaches').getByText('Bus operator')).toBeTruthy();
  });

  it('an events account that also runs buses carries a small Bus badge; a plain one does not', async () => {
    list.mockResolvedValue(respond([eventsOrg, busOrg]));
    renderPage();
    await screen.findByText('Both Ways Travel');
    expect(rowOf('Both Ways Travel').getByText('Bus')).toBeTruthy();
    expect(rowOf('Sunshine Events').queryByText('Bus')).toBeNull();
  });
});

describe('OrganizersPage — venue trading cell', () => {
  beforeEach(() => {
    list.mockResolvedValue(respond([venueNone, venueOn, venueSuspended, venueTransport]));
  });

  it('shows On with the venue name, currency and start date', async () => {
    renderPage('/organizers?type=venues');
    await screen.findByText('Kwa-Linda Lounge');
    const row = rowOf('Kwa-Linda Lounge');
    expect(row.getByText('On')).toBeTruthy();
    expect(row.getByText('Kwa-Linda Rooftop')).toBeTruthy();
    expect(row.getByText('ZAR · since 01 Oct 2026')).toBeTruthy();
    expect(row.queryByRole('button', { name: 'Switch on' })).toBeNull();
  });

  it('shows Suspended with the venue name and currency, and no start date', async () => {
    renderPage('/organizers?type=venues');
    await screen.findByText('Closed Cellar');
    const row = rowOf('Closed Cellar');
    expect(row.getByText('Suspended')).toBeTruthy();
    expect(row.getByText('Cellar Bar')).toBeTruthy();
    expect(row.getByText('SZL')).toBeTruthy();
    expect(row.queryByText(/since/)).toBeNull();
    expect(row.queryByRole('button', { name: 'Switch on' })).toBeNull();
  });

  it('shows Not on yet with a Switch on button when there is no venue', async () => {
    renderPage('/organizers?type=venues');
    await screen.findByText('Dry Lounge');
    const row = rowOf('Dry Lounge');
    expect(row.getByText('Not on yet')).toBeTruthy();
    expect(row.getByRole('button', { name: 'Switch on' })).toBeTruthy();
  });

  it('offers no Switch on to an account the API would refuse (it never holds the venue permission)', async () => {
    renderPage('/organizers?type=venues');
    await screen.findByText('Rolling Bar');
    const row = rowOf('Rolling Bar');
    expect(row.getByText('Not on yet')).toBeTruthy();
    expect(row.queryByRole('button', { name: 'Switch on' })).toBeNull();
  });

  it('Switch on opens the venue switch-on dialog for that row, and confirming switches it on', async () => {
    vi.mocked(apiClient.organizers.activateVenue).mockResolvedValue({} as never);
    renderPage('/organizers?type=venues');
    await screen.findByText('Dry Lounge');

    fireEvent.click(rowOf('Dry Lounge').getByRole('button', { name: 'Switch on' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Switch on venue trading')).toBeTruthy();
    expect((within(dialog).getByLabelText(/venue name/i) as HTMLInputElement).value).toBe('Dry Lounge');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Switch on' }));
    await waitFor(() =>
      expect(apiClient.organizers.activateVenue).toHaveBeenCalledWith({ vendorId: 'v-none', name: 'Dry Lounge', currency: 'SZL' }),
    );
  });

  it('the other tabs have no Venue trading column, so no Switch on button either', async () => {
    renderPage();
    await screen.findByText('Dry Lounge');
    expect(screen.queryByRole('button', { name: 'Switch on' })).toBeNull();
  });
});

describe('OrganizersPage — server-side filters', () => {
  it('sends the default sort (newest) and no tab-specific filter', async () => {
    renderPage();
    await screen.findByText('Sunshine Events');
    expect(lastParams()).toEqual({
      search: '', status: undefined, type: undefined, venueTrading: undefined, category: undefined,
      sort: 'newest', page: 1, limit: 25,
    });
  });

  it('the Venue trading select offers All / On / Not on yet / Suspended and sends venueTrading', async () => {
    renderPage('/organizers?type=venues');
    await screen.findByText('Sunshine Events');
    const select = screen.getByLabelText('Venue trading') as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual(['All', 'On', 'Not on yet', 'Suspended']);

    for (const value of ['on', 'none', 'suspended']) {
      fireEvent.change(select, { target: { value } });
      await waitFor(() => expect(lastParams()).toMatchObject({ type: 'venues', venueTrading: value }));
    }
    fireEvent.change(select, { target: { value: '' } });
    await waitFor(() => expect(lastParams().venueTrading).toBeUndefined());
  });

  it('the Category select takes its options from serviceCategories and sends category', async () => {
    renderPage('/organizers?type=services');
    await screen.findByText('Sunshine Events');
    const select = screen.getByLabelText('Category') as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual(['All', 'Beauty And Wellness', 'Food And Drink']);

    fireEvent.change(select, { target: { value: 'food_and_drink' } });
    await waitFor(() => expect(lastParams()).toMatchObject({ type: 'services', category: 'food_and_drink' }));
  });

  it('shows the Venue trading select only on Venues and the Category select only on Businesses', async () => {
    renderPage();
    await screen.findByText('Sunshine Events');
    expect(screen.queryByLabelText('Venue trading')).toBeNull();
    expect(screen.queryByLabelText('Category')).toBeNull();

    openTab(/^Venues/);
    await waitFor(() => expect(screen.getByLabelText('Venue trading')).toBeTruthy());
    expect(screen.queryByLabelText('Category')).toBeNull();

    openTab(/^Businesses/);
    await waitFor(() => expect(screen.getByLabelText('Category')).toBeTruthy());
    expect(screen.queryByLabelText('Venue trading')).toBeNull();
  });

  it('status buttons show their counts from statusCounts and send status', async () => {
    renderPage();
    await screen.findByText('Sunshine Events');
    expect(screen.getByRole('button', { name: 'All (12)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Verified (7)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Rejected (1)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Suspended (2)' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Pending (2)' }));
    await waitFor(() => expect(lastParams().status).toBe('pending'));

    fireEvent.click(screen.getByRole('button', { name: 'All (12)' }));
    await waitFor(() => expect(lastParams().status).toBeUndefined());
  });

  it('the stat cards read the tab-scoped statusCounts', async () => {
    renderPage();
    await screen.findByText('Sunshine Events');
    // verified 7 · pending 2 · rejected + suspended 3 · total 12
    for (const [title, value] of [['Total organizers', '12'], ['Verified', '7'], ['Pending review', '2'], ['Rejected / suspended', '3']]) {
      expect(screen.getByText(title).parentElement!.textContent).toContain(value);
    }
  });

  it('typing in the search box sends search after the debounce', async () => {
    renderPage();
    await screen.findByText('Sunshine Events');
    fireEvent.change(screen.getByPlaceholderText(/search name, email or phone/i), { target: { value: ' glow ' } });
    await waitFor(() => expect(lastParams().search).toBe('glow'));
  });

  it('Business and Joined headers sort on the server, with aria-sort and an arrow showing which', async () => {
    renderPage();
    await screen.findByText('Sunshine Events');
    const business = () => screen.getByRole('columnheader', { name: 'Business' });
    const joined = () => screen.getByRole('columnheader', { name: 'Joined' });
    expect(business().getAttribute('aria-sort')).toBe('none');
    expect(joined().getAttribute('aria-sort')).toBe('descending');

    fireEvent.click(within(business()).getByRole('button'));
    await waitFor(() => expect(lastParams().sort).toBe('name'));
    expect(business().getAttribute('aria-sort')).toBe('ascending');
    expect(joined().getAttribute('aria-sort')).toBe('none');

    // From the name sort, Joined starts at newest, then toggles.
    fireEvent.click(within(joined()).getByRole('button'));
    await waitFor(() => expect(lastParams().sort).toBe('newest'));
    expect(joined().getAttribute('aria-sort')).toBe('descending');

    fireEvent.click(within(joined()).getByRole('button'));
    await waitFor(() => expect(lastParams().sort).toBe('oldest'));
    expect(joined().getAttribute('aria-sort')).toBe('ascending');

    fireEvent.click(within(joined()).getByRole('button'));
    await waitFor(() => expect(lastParams().sort).toBe('newest'));
  });

  it('the other columns are not sortable', async () => {
    renderPage();
    await screen.findByText('Sunshine Events');
    for (const name of ['Type', 'Contact', 'Status']) {
      const header = screen.getByRole('columnheader', { name });
      expect(within(header).queryByRole('button')).toBeNull();
      expect(header.getAttribute('aria-sort')).toBeNull();
    }
  });

  it.each([
    ['a status button', () => fireEvent.click(screen.getByRole('button', { name: 'Pending (2)' })), { status: 'pending' }],
    ['a sort header', () => fireEvent.click(within(screen.getByRole('columnheader', { name: 'Business' })).getByRole('button')), { sort: 'name' }],
  ])('%s resets the page to 1', async (_label, act, expected) => {
    threePages([eventsOrg]);
    renderPage();
    await screen.findByText('Sunshine Events');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(lastParams().page).toBe(2));

    act();

    await waitFor(() => expect(lastParams()).toMatchObject({ ...expected, page: 1 }));
  });

  it('the Venue trading and Category selects reset the page to 1', async () => {
    threePages([venueNone]);
    renderPage('/organizers?type=venues');
    await screen.findByText('Dry Lounge');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(lastParams().page).toBe(2));
    fireEvent.change(screen.getByLabelText('Venue trading'), { target: { value: 'on' } });
    await waitFor(() => expect(lastParams()).toMatchObject({ venueTrading: 'on', page: 1 }));

    cleanup();
    threePages([glowSpa]);
    renderPage('/organizers?type=services');
    await screen.findByText('Glow Spa');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(lastParams().page).toBe(2));
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'food_and_drink' } });
    await waitFor(() => expect(lastParams()).toMatchObject({ category: 'food_and_drink', page: 1 }));
  });
});

describe('OrganizersPage — switching tab', () => {
  it('clears Venue trading and goes back to page 1, keeping status and sort', async () => {
    threePages([venueNone]);
    renderPage('/organizers?type=venues');
    await screen.findByText('Dry Lounge');
    fireEvent.change(screen.getByLabelText('Venue trading'), { target: { value: 'on' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pending (2)' }));
    fireEvent.click(within(screen.getByRole('columnheader', { name: 'Business' })).getByRole('button'));
    await waitFor(() => expect(lastParams()).toMatchObject({ venueTrading: 'on', status: 'pending', sort: 'name' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(lastParams().page).toBe(2));

    openTab(/^Businesses/);

    await waitFor(() => expect(lastParams()).toMatchObject({
      type: 'services', venueTrading: undefined, category: undefined, page: 1, status: 'pending', sort: 'name',
    }));
    expect(url()).toBe('/organizers?type=services');
  });

  it('clears Category on the way out, and the Venue trading select is back at All when you return', async () => {
    renderPage('/organizers?type=services');
    await screen.findByText('Sunshine Events');
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'food_and_drink' } });
    await waitFor(() => expect(lastParams().category).toBe('food_and_drink'));

    openTab(/^Venues/);

    await waitFor(() => expect(lastParams()).toMatchObject({ type: 'venues', category: undefined, venueTrading: undefined }));
    expect((screen.getByLabelText('Venue trading') as HTMLSelectElement).value).toBe('');

    openTab(/^Businesses/);
    await waitFor(() => expect((screen.getByLabelText('Category') as HTMLSelectElement).value).toBe(''));
  });

  // Back/forward and pasted links change the URL without touching a tab, so the
  // reset can't live in the click handler: a stale venueTrading would be sent
  // with type=events and the API refuses that with a 400.
  it('clears tab-specific filters when the URL changes some other way (back, forward, a link)', async () => {
    renderPage('/organizers?type=venues');
    await screen.findByText('Sunshine Events');
    fireEvent.change(screen.getByLabelText('Venue trading'), { target: { value: 'on' } });
    await waitFor(() => expect(lastParams().venueTrading).toBe('on'));

    navigateTo('/organizers?type=events');

    await waitFor(() => expect(lastParams().type).toBe('events'));
    expect(list.mock.calls.every(([p]) => !(p.type === 'events' && p.venueTrading))).toBe(true);
    expect(lastParams().venueTrading).toBeUndefined();
  });

  it('shows Loading, not the previous tab\'s rows, while the new tab loads', async () => {
    renderPage();
    await screen.findByText('Sunshine Events');
    list.mockReturnValue(new Promise(() => {}));

    openTab(/^Venues/);

    await screen.findByText('Loading…');
    expect(screen.queryByText('Sunshine Events')).toBeNull();
    // The tab counts don't depend on the tab, so they stay; the per-tab numbers don't.
    expect(screen.getByRole('tab', { name: 'Venues (12)' })).toBeTruthy();
    expect(screen.getByText('Total organizers').parentElement!.textContent).toContain('—');
  });
});

describe('OrganizersPage — empty and failed lists', () => {
  it('says "No organizers yet." when nothing is filtered', async () => {
    list.mockResolvedValue(respond([]));
    renderPage();
    expect(await screen.findByText('No organizers yet.')).toBeTruthy();
  });

  it('says "No organizers match your filters." when a tab is open', async () => {
    list.mockResolvedValue(respond([]));
    renderPage('/organizers?type=venues');
    expect(await screen.findByText('No organizers match your filters.')).toBeTruthy();
  });

  it('says "No organizers match your filters." when a status is filtered', async () => {
    renderPage();
    await screen.findByText('Sunshine Events');
    list.mockResolvedValue(respond([]));
    fireEvent.click(screen.getByRole('button', { name: 'Pending (2)' }));
    expect(await screen.findByText('No organizers match your filters.')).toBeTruthy();
  });

  it('a failed list shows the error and Try again — never an empty table', async () => {
    list.mockRejectedValueOnce(new Error('Organizers are unavailable'));
    renderPage();

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('Organizers are unavailable')).toBeTruthy();
    expect(within(alert).getByRole('button', { name: 'Try again' })).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByText('No organizers yet.')).toBeNull();
    expect(screen.queryByText('No organizers match your filters.')).toBeNull();
    // The stat cards show a dash for "unknown", not a zero.
    expect(screen.getByText('Total organizers').parentElement!.textContent).toContain('—');
  });

  it('Try again fetches the list again and shows it', async () => {
    list.mockRejectedValueOnce(new Error('Organizers are unavailable'));
    renderPage();
    fireEvent.click(within(await screen.findByRole('alert')).getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Sunshine Events')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('a refetch that fails after an action shows the error, not the old rows and numbers', async () => {
    vi.mocked(apiClient.organizers.updateVerification).mockResolvedValue({} as never);
    renderPage();
    await screen.findByText('Sunshine Events');
    list.mockRejectedValueOnce(new Error('Organizers are unavailable'));

    fireEvent.pointerDown(within(screen.getByText('Sunshine Events').closest('tr')!).getByRole('button', { name: /actions/i }), {
      button: 0, ctrlKey: false, pointerType: 'mouse',
    });
    fireEvent.click(await screen.findByRole('menuitem', { name: /move to pending/i }));

    expect(within(await screen.findByRole('alert')).getByText('Organizers are unavailable')).toBeTruthy();
    expect(screen.queryByText('Sunshine Events')).toBeNull();
    expect(screen.getByText('Total organizers').parentElement!.textContent).toContain('—');
  });

  it('a failure on another tab is shown on that tab, and the tabs still work', async () => {
    renderPage();
    await screen.findByText('Sunshine Events');
    list.mockRejectedValueOnce(new Error('Venues lookup failed'));

    openTab(/^Venues/);

    expect(within(await screen.findByRole('alert')).getByText('Venues lookup failed')).toBeTruthy();
    openTab(/^All/);
    expect(await screen.findByText('Sunshine Events')).toBeTruthy();
  });
});
