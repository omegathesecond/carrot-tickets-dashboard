// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AuthUser } from '@/types';

let currentUser: AuthUser | null = { _id: 'v1' } as AuthUser;
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: currentUser }) }));
vi.mock('@/lib/api', () => ({ apiClient: { venue: { mine: vi.fn() } } }));
vi.mock('@/components/cashless/EventStallsPanel', () => ({
  EventStallsPanel: (p: { scope: unknown }) => <div>stalls-panel {JSON.stringify(p.scope)}</div>,
}));
vi.mock('@/components/cashless/EventCataloguePanel', () => ({
  EventCataloguePanel: (p: { scope: unknown; currency?: string }) => <div>catalogue-panel {JSON.stringify(p.scope)} {p.currency}</div>,
}));

import { apiClient } from '@/lib/api';
import { VenuePage } from '@/pages/VenuePage';

const ACTIVE = { eligible: true, venue: { id: 'ven1', name: 'Kwa-Linda Lounge', currency: 'SZL', status: 'active', activatedAt: '2026-10-01T08:00:00.000Z' } };

function renderAt(url: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><MemoryRouter initialEntries={[url]}><VenuePage /></MemoryRouter></QueryClientProvider>);
}

beforeEach(() => { vi.clearAllMocks(); currentUser = { _id: 'v1' } as AuthUser; });
afterEach(cleanup);

describe('VenuePage — trading tabs', () => {
  it('an active venue opens on Stalls, scoped to the venue', async () => {
    (apiClient.venue.mine as any).mockResolvedValue(ACTIVE);
    renderAt('/venue');
    expect(await screen.findByText('stalls-panel {"kind":"venue"}')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Stalls' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Catalogue & stock' })).toBeTruthy();
  });

  it('?tab=catalogue shows the catalogue in the venue currency', async () => {
    (apiClient.venue.mine as any).mockResolvedValue(ACTIVE);
    renderAt('/venue?tab=catalogue');
    expect(await screen.findByText('catalogue-panel {"kind":"venue"} SZL')).toBeTruthy();
  });

  it('a suspended or not-yet-on venue shows no trading tabs', async () => {
    (apiClient.venue.mine as any).mockResolvedValue({ eligible: true, venue: null });
    renderAt('/venue');
    expect(await screen.findByText("Venue trading isn't on yet")).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'Stalls' })).toBeNull();
  });

  it('a team member without tickets:manage_stock sees Stalls but not Catalogue', async () => {
    currentUser = { permissions: ['tickets:manage_venue'] } as unknown as AuthUser;
    (apiClient.venue.mine as any).mockResolvedValue(ACTIVE);
    renderAt('/venue');
    expect(await screen.findByRole('tab', { name: 'Stalls' })).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'Catalogue & stock' })).toBeNull();
  });
});
