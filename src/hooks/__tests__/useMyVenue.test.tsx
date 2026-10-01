// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { AuthUser } from '@/types';

let currentUser: AuthUser | null = null;
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: currentUser }) }));
vi.mock('@/lib/api', () => ({ apiClient: { venue: { mine: vi.fn() } } }));

import { apiClient } from '@/lib/api';
import { useMyVenue } from '@/hooks/useMyVenue';

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  (apiClient.venue.mine as any).mockResolvedValue({ venue: null, eligible: true });
});

describe('useMyVenue', () => {
  it('fetches for an owner (no permissions array = full access)', async () => {
    currentUser = { _id: 'v1' } as AuthUser;
    const { result } = renderHook(() => useMyVenue(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual({ venue: null, eligible: true }));
  });

  it('never fetches for a super-admin or a user without MANAGE_VENUE', async () => {
    for (const u of [{ isSuperAdmin: true }, { permissions: ['tickets:view_sales'] }]) {
      currentUser = u as unknown as AuthUser;
      renderHook(() => useMyVenue(), { wrapper });
    }
    await new Promise((r) => setTimeout(r, 20));
    expect(apiClient.venue.mine).not.toHaveBeenCalled();
  });
});
