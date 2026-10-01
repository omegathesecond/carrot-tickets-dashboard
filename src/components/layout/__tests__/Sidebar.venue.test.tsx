// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AuthUser } from '@/types';

let currentUser: AuthUser | null = { _id: 'v1' } as AuthUser;
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: currentUser }) }));
vi.mock('@/lib/api', () => ({ apiClient: { venue: { mine: vi.fn() } } }));
vi.mock('@/lib/socialFeed', () => ({ SOCIAL_LOGIN_URL: 'https://x', mintSocialFeedUrl: vi.fn() }));

import { apiClient } from '@/lib/api';
import { Sidebar } from '@/components/layout/Sidebar';

function renderSidebar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><Sidebar open onClose={() => {}} /></MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { _id: 'v1' } as AuthUser;
});
afterEach(cleanup);

describe('Sidebar — Venue', () => {
  it('shows Venue for an eligible account', async () => {
    (apiClient.venue.mine as any).mockResolvedValue({ eligible: true, venue: null });
    renderSidebar();
    expect((await screen.findByRole('link', { name: /^venue$/i })).getAttribute('href')).toBe('/venue');
  });

  it('hides Venue for an account that does not use venue trading', async () => {
    (apiClient.venue.mine as any).mockResolvedValue({ eligible: false, venue: null });
    renderSidebar();
    await waitFor(() => expect(apiClient.venue.mine).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole('link', { name: /^venue$/i })).toBeNull();
  });

  it('keeps Venue reachable when the lookup fails, so the page can show the error', async () => {
    (apiClient.venue.mine as any).mockRejectedValue(new Error('Network down'));
    renderSidebar();
    expect(await screen.findByRole('link', { name: /^venue$/i })).toBeTruthy();
  });

  it('never looks up a venue for a super-admin', async () => {
    currentUser = { isSuperAdmin: true } as unknown as AuthUser;
    renderSidebar();
    await new Promise((r) => setTimeout(r, 20));
    expect(apiClient.venue.mine).not.toHaveBeenCalled();
  });
});
