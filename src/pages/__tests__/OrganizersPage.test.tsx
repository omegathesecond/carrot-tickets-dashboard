// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
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
  type: 'transport',
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
  type: 'services',
};

function mockResponse(organizers: Organizer[]): OrganizersListResponse {
  return {
    organizers,
    statusCounts: {},
    typeCounts: { all: organizers.length, events: 0, venues: 0, services: 1, transport: 1 },
    serviceCategories: ['beauty_and_wellness'],
    pagination: { page: 1, limit: 25, total: organizers.length, totalPages: 1 },
  };
}

function renderPage(path = '/organizers') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <OrganizersPage />
      </MemoryRouter>
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
  it('shows each vendor\'s type badge on the All tab and the humanised category on the Businesses tab', async () => {
    renderPage();

    await screen.findByText('Sunshine Coaches');
    expect(within(screen.getByText('Sunshine Coaches').closest('tr')!).getByText('Bus operator')).toBeTruthy();
    expect(within(screen.getByText('Glow Spa').closest('tr')!).getByText('Business')).toBeTruthy();

    cleanup();
    renderPage('/organizers?type=services');
    await screen.findByText('Glow Spa');
    expect(within(screen.getByText('Glow Spa').closest('tr')!).getByText('Beauty And Wellness')).toBeTruthy();
  });

  it('calls organizers.list with type: "services" when the Businesses tab is opened', async () => {
    renderPage();

    await screen.findByText('Sunshine Coaches');

    // Radix's TabsTrigger selects on POINTER-DOWN, not click.
    fireEvent.mouseDown(screen.getByRole('tab', { name: /businesses/i }), { button: 0 });

    await waitFor(() => {
      expect(apiClient.organizers.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: 'services' }),
      );
    });
  });

  it('does not pass a type for the default All tab', async () => {
    renderPage();
    await screen.findByText('Sunshine Coaches');

    expect(apiClient.organizers.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: undefined }),
    );
  });
});
