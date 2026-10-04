// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';
import { OrganizersPage } from '@/pages/OrganizersPage';
import { apiClient } from '@/lib/api';
import type { Organizer } from '@/types';

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

const base: Organizer = {
  id: 'org-1', businessName: 'Kwa-Linda Lounge', email: 'bar@x.com', phoneNumber: null, primaryContact: null,
  businessType: 'venue', operatorType: 'events', verificationStatus: 'verified', verifiedAt: null, rejectionReason: null,
  isActive: true, createdAt: '2026-09-01T00:00:00.000Z', eventCount: 0, ticketsSold: 0, revenue: 0, venue: null, type: 'venues',
};

function list(organizers: Organizer[]) {
  (apiClient.organizers.list as any).mockResolvedValue({
    organizers, statusCounts: {}, typeCounts: { all: organizers.length, events: 0, venues: organizers.length, services: 0, transport: 0 },
    serviceCategories: [], pagination: { page: 1, limit: 25, total: organizers.length, totalPages: 1 },
  });
}

function renderPage(path = '/organizers') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><MemoryRouter initialEntries={[path]}><OrganizersPage /></MemoryRouter></QueryClientProvider>);
}

// The venue's state is the Venue trading column of the Venues tab.
async function venueRow() {
  return within(await screen.findByRole('row', { name: /Kwa-Linda Lounge/ }));
}

function openActions() {
  const trigger = screen.getByRole('button', { name: /actions/i });
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' });
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe('OrganizersPage — venue trading switch', () => {
  it('switches venue trading on with a name (prefilled) and a currency', async () => {
    list([base]);
    (apiClient.organizers.activateVenue as any).mockResolvedValue({ id: 'ven1', name: 'Kwa-Linda Lounge', currency: 'ZAR', status: 'active', activatedAt: '2026-10-01T00:00:00.000Z' });
    renderPage();
    await screen.findByText('Kwa-Linda Lounge');
    openActions();
    fireEvent.click(await screen.findByRole('menuitem', { name: /switch on venue trading/i }));

    const dialog = await screen.findByRole('dialog');
    expect((within(dialog).getByLabelText(/venue name/i) as HTMLInputElement).value).toBe('Kwa-Linda Lounge');
    fireEvent.change(within(dialog).getByLabelText(/currency/i), { target: { value: 'ZAR' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /switch on/i }));

    await waitFor(() =>
      expect(apiClient.organizers.activateVenue).toHaveBeenCalledWith({ vendorId: 'org-1', name: 'Kwa-Linda Lounge', currency: 'ZAR' }),
    );
    expect(toast.success).toHaveBeenCalled();
  });

  it('a refused switch-on (409) is toasted with the API message', async () => {
    list([base]);
    (apiClient.organizers.activateVenue as any).mockRejectedValue(new Error('This vendor already has a venue'));
    renderPage();
    await screen.findByText('Kwa-Linda Lounge');
    openActions();
    fireEvent.click(await screen.findByRole('menuitem', { name: /switch on venue trading/i }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /switch on/i }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('This vendor already has a venue'));
  });

  it('an active venue shows as On and can be suspended', async () => {
    list([{ ...base, venue: { id: 'ven1', name: 'Kwa-Linda Lounge', currency: 'SZL', status: 'active', activatedAt: '2026-10-01T00:00:00.000Z' } }]);
    (apiClient.organizers.setVenueStatus as any).mockResolvedValue({});
    renderPage('/organizers?type=venues');
    expect((await venueRow()).getByText('On')).toBeTruthy();
    openActions();
    // Wait for the menu to be open before asserting the switch-on item is absent.
    const suspend = await screen.findByRole('menuitem', { name: /suspend venue trading/i });
    expect(screen.queryByRole('menuitem', { name: /switch on venue trading/i })).toBeNull();
    fireEvent.click(suspend);
    await waitFor(() => expect(apiClient.organizers.setVenueStatus).toHaveBeenCalledWith('ven1', 'suspended'));
  });

  it('a suspended venue can be reactivated', async () => {
    list([{ ...base, venue: { id: 'ven1', name: 'Kwa-Linda Lounge', currency: 'SZL', status: 'suspended', activatedAt: '2026-10-01T00:00:00.000Z' } }]);
    (apiClient.organizers.setVenueStatus as any).mockResolvedValue({});
    renderPage('/organizers?type=venues');
    expect((await venueRow()).getByText('Suspended')).toBeTruthy();
    openActions();
    fireEvent.click(await screen.findByRole('menuitem', { name: /reactivate venue trading/i }));
    await waitFor(() => expect(apiClient.organizers.setVenueStatus).toHaveBeenCalledWith('ven1', 'active'));
  });

  // The API refuses these (409) because their permission set never includes
  // the venue permission — so don't offer the action at all.
  it.each(['services', 'transport'])('does not offer to switch venue trading on for a %s account', async (operatorType) => {
    list([{ ...base, operatorType }]);
    renderPage();
    await screen.findByText('Kwa-Linda Lounge');
    openActions();
    // The menu is open once its verification items render.
    await screen.findByRole('menuitem', { name: /move to pending/i });
    expect(screen.queryByRole('menuitem', { name: /switch on venue trading/i })).toBeNull();
  });

  it('an events or both account is still offered the switch-on', async () => {
    list([{ ...base, operatorType: 'both' }]);
    renderPage();
    await screen.findByText('Kwa-Linda Lounge');
    openActions();
    expect(await screen.findByRole('menuitem', { name: /switch on venue trading/i })).toBeTruthy();
  });

  it('a services account that already has a venue can still be suspended', async () => {
    list([{ ...base, operatorType: 'services', venue: { id: 'ven1', name: 'Kwa-Linda Lounge', currency: 'SZL', status: 'active', activatedAt: '2026-10-01T00:00:00.000Z' } }]);
    renderPage();
    await screen.findByText('Kwa-Linda Lounge');
    openActions();
    expect(await screen.findByRole('menuitem', { name: /suspend venue trading/i })).toBeTruthy();
  });

  // refetchOnWindowFocus is off app-wide, so without an explicit refetch a
  // refused switch-on leaves the row offering "Switch on" until a reload.
  it('after a refused switch-on the list is refetched and the dialog closes (the error toast stays)', async () => {
    list([base]);
    (apiClient.organizers.activateVenue as any).mockRejectedValue(new Error('This vendor already has a venue'));
    renderPage();
    await screen.findByText('Kwa-Linda Lounge');
    expect(apiClient.organizers.list).toHaveBeenCalledTimes(1);
    openActions();
    fireEvent.click(await screen.findByRole('menuitem', { name: /switch on venue trading/i }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /switch on/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('This vendor already has a venue'));
    await waitFor(() => expect(apiClient.organizers.list).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('after a failed suspend the list is refetched too, so the row shows the truth', async () => {
    list([{ ...base, venue: { id: 'ven1', name: 'Kwa-Linda Lounge', currency: 'SZL', status: 'active', activatedAt: '2026-10-01T00:00:00.000Z' } }]);
    (apiClient.organizers.setVenueStatus as any).mockRejectedValue(new Error('Venue not found'));
    renderPage('/organizers?type=venues');
    expect((await venueRow()).getByText('On')).toBeTruthy();
    expect(apiClient.organizers.list).toHaveBeenCalledTimes(1);
    openActions();
    fireEvent.click(await screen.findByRole('menuitem', { name: /suspend venue trading/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Venue not found'));
    await waitFor(() => expect(apiClient.organizers.list).toHaveBeenCalledTimes(2));
  });
});
