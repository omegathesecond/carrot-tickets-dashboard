// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OrganizersPage } from '@/pages/OrganizersPage';
import { apiClient } from '@/lib/api';
import type { Organizer, OrganizersListResponse } from '@/types';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('@/lib/api', () => ({
  apiClient: {
    organizers: {
      list: vi.fn(),
      updateVerification: vi.fn(),
      create: vi.fn(),
    },
  },
}));

const eventsOrganizer: Organizer = {
  id: 'org-events',
  businessName: 'Sunshine Coaches',
  email: 'sunshine@example.com',
  phoneNumber: null,
  primaryContact: null,
  businessType: 'transport_company',
  operatorType: 'transport',
  verificationStatus: 'verified',
  verifiedAt: null,
  rejectionReason: null,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  eventCount: 3,
  ticketsSold: 100,
  revenue: 5000,
};

const servicesOrganizer: Organizer = {
  id: 'org-services',
  businessName: 'Glow Spa',
  email: 'glow@example.com',
  phoneNumber: null,
  primaryContact: null,
  businessType: null,
  operatorType: 'services',
  serviceCategory: 'beauty_and_wellness',
  verificationStatus: 'pending',
  verifiedAt: null,
  rejectionReason: null,
  isActive: true,
  createdAt: '2026-02-01T00:00:00.000Z',
  eventCount: 0,
  ticketsSold: 0,
  revenue: 0,
};

function mockResponse(organizers: Organizer[]): OrganizersListResponse {
  return {
    organizers,
    statusCounts: {},
    pagination: { page: 1, limit: 25, total: organizers.length, totalPages: 1 },
  };
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <OrganizersPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  (apiClient.organizers.list as any).mockResolvedValue(mockResponse([eventsOrganizer, servicesOrganizer]));
});

afterEach(() => {
  cleanup();
});

describe('OrganizersPage — service business visibility', () => {
  it('shows a "Service · <category>" badge for a services vendor and businessType for an events vendor', async () => {
    renderPage();

    await screen.findByText('Sunshine Coaches');
    // businessType is rendered lowercase in the DOM; "capitalize" is a CSS
    // text-transform only, not an actual text change. getByText throws if
    // no match is found, so a successful call is itself the assertion.
    expect(screen.getByText('transport company')).toBeTruthy();

    expect(screen.getByText('Glow Spa')).toBeTruthy();
    expect(screen.getByText('Service · Beauty And Wellness')).toBeTruthy();
  });

  it('calls organizers.list with operatorType: "services" when the Service businesses filter is selected', async () => {
    renderPage();

    await screen.findByText('Sunshine Coaches');

    const select = screen.getByLabelText('Filter by type');
    fireEvent.change(select, { target: { value: 'services' } });

    await waitFor(() => {
      expect(apiClient.organizers.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ operatorType: 'services' }),
      );
    });
  });

  it('does not pass operatorType for the default "All types" filter', async () => {
    renderPage();
    await screen.findByText('Sunshine Coaches');

    expect(apiClient.organizers.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ operatorType: undefined }),
    );
  });
});
