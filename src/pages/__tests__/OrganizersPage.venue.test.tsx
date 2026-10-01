// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
  isActive: true, createdAt: '2026-09-01T00:00:00.000Z', eventCount: 0, ticketsSold: 0, revenue: 0, venue: null,
};

function list(organizers: Organizer[]) {
  (apiClient.organizers.list as any).mockResolvedValue({
    organizers, statusCounts: {}, pagination: { page: 1, limit: 25, total: organizers.length, totalPages: 1 },
  });
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><OrganizersPage /></QueryClientProvider>);
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

  it('an active venue shows its badge and can be suspended', async () => {
    list([{ ...base, venue: { id: 'ven1', name: 'Kwa-Linda Lounge', currency: 'SZL', status: 'active', activatedAt: '2026-10-01T00:00:00.000Z' } }]);
    (apiClient.organizers.setVenueStatus as any).mockResolvedValue({});
    renderPage();
    expect(await screen.findByText('Venue · on')).toBeTruthy();
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
    renderPage();
    expect(await screen.findByText('Venue · suspended')).toBeTruthy();
    openActions();
    fireEvent.click(await screen.findByRole('menuitem', { name: /reactivate venue trading/i }));
    await waitFor(() => expect(apiClient.organizers.setVenueStatus).toHaveBeenCalledWith('ven1', 'active'));
  });
});
