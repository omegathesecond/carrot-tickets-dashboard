// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '../AuthContext';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
vi.mock('@/lib/api', () => ({ apiClient: { auth: { getMe: vi.fn(), logout: vi.fn() } } }));
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });
it('keeps the authenticated user and cache when logout fails and reports the failure', async () => {
  localStorage.setItem('keshless_tickets_token', 'access');
  vi.mocked(apiClient.auth.getMe).mockResolvedValue({ _id: 'organizer', userType: 'vendor' } as any);
  vi.mocked(apiClient.auth.logout).mockRejectedValue(new Error('Server unavailable'));
  const client = new QueryClient();
  client.setQueryData(['private'], 'private data');
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}><AuthProvider>{children}</AuthProvider></QueryClientProvider>;
  const { result } = renderHook(useAuth, { wrapper });
  await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
  await act(() => result.current.logout());
  expect(result.current.isAuthenticated).toBe(true);
  expect(client.getQueryData(['private'])).toBe('private data');
  expect(localStorage.getItem('keshless_tickets_token')).toBe('access');
  expect(toast.error).toHaveBeenCalledWith('Logout failed: Server unavailable');
});
it('drops shared authentication and cached data when another tab logs out', async () => {
  localStorage.setItem('keshless_tickets_token', 'access');
  vi.mocked(apiClient.auth.getMe).mockResolvedValue({ _id: 'organizer', userType: 'vendor' } as any);
  const client = new QueryClient();
  client.setQueryData(['private'], 'private data');
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}><AuthProvider>{children}</AuthProvider></QueryClientProvider>;
  const { result } = renderHook(useAuth, { wrapper });
  await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
  act(() => {
    localStorage.removeItem('keshless_tickets_token');
    window.dispatchEvent(new StorageEvent('storage', { key: 'keshless_tickets_token' }));
  });
  expect(result.current.isAuthenticated).toBe(false);
  expect(client.getQueryData(['private'])).toBeUndefined();
});
