// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AuthUser } from '@/types';

let currentUser: AuthUser | null = { _id: 'v1' } as AuthUser;
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: currentUser }) }));
vi.mock('@/lib/api', () => ({ apiClient: { venue: { mine: vi.fn() } } }));

import { apiClient } from '@/lib/api';
import { VenuePage } from '@/pages/VenuePage';

const mine = () => apiClient.venue.mine as any;

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><VenuePage /></QueryClientProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { _id: 'v1' } as AuthUser;
});
afterEach(cleanup);

describe('VenuePage', () => {
  it('active venue: name, Active, currency and switch-on date', async () => {
    mine().mockResolvedValue({
      eligible: true,
      venue: { id: 'ven1', name: 'Kwa-Linda Lounge', currency: 'SZL', status: 'active', activatedAt: '2026-10-01T08:00:00.000Z' },
    });
    renderPage();
    expect(await screen.findByText('Kwa-Linda Lounge')).toBeTruthy();
    expect(screen.getByText('Active')).toBeTruthy();
    expect(screen.getByText('Lilangeni (E)')).toBeTruthy();
    expect(screen.getByText('01 Oct 2026')).toBeTruthy();
  });

  it('venue account not switched on yet', async () => {
    mine().mockResolvedValue({ eligible: true, venue: null });
    renderPage();
    expect(await screen.findByText("Venue trading isn't on yet")).toBeTruthy();
    expect(screen.getByText('Carrot switches it on after a quick check.')).toBeTruthy();
  });

  it('suspended venue', async () => {
    mine().mockResolvedValue({
      eligible: true,
      venue: { id: 'ven1', name: 'X', currency: 'ZAR', status: 'suspended', activatedAt: '2026-10-01T08:00:00.000Z' },
    });
    renderPage();
    expect(await screen.findByText('Venue trading is suspended')).toBeTruthy();
    expect(screen.getByText('Contact Carrot.')).toBeTruthy();
  });

  it('a failed lookup shows the error with Try again — never the not-on-yet card', async () => {
    mine().mockRejectedValueOnce(new Error('Network down')).mockResolvedValueOnce({ eligible: true, venue: null });
    renderPage();
    expect(await screen.findByText('Network down')).toBeTruthy();
    expect(screen.queryByText("Venue trading isn't on yet")).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    await waitFor(() => expect(mine()).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Venue trading isn't on yet")).toBeTruthy();
  });

  it('a user without MANAGE_VENUE gets no-access and no lookup', async () => {
    currentUser = { permissions: ['tickets:view_sales'] } as unknown as AuthUser;
    renderPage();
    expect(await screen.findByText("You don't have access to the venue")).toBeTruthy();
    expect(mine()).not.toHaveBeenCalled();
  });

  it('an account that does not use venue trading', async () => {
    mine().mockResolvedValue({ eligible: false, venue: null });
    renderPage();
    expect(await screen.findByText("This account doesn't use venue trading")).toBeTruthy();
  });
});
