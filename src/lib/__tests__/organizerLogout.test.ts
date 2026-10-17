// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { ApiClient } from '../api';
beforeEach(() => { localStorage.clear(); });
afterEach(() => vi.unstubAllGlobals());
it('removes both credentials only after the server confirms logout', async () => {
  const client = new ApiClient('https://example.test/api');
  client.setToken('access', 'refresh');
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true, data: null }), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  await client.auth.logout();
  expect(localStorage.getItem('keshless_tickets_token')).toBeNull();
  expect(localStorage.getItem('keshless_tickets_refresh_token')).toBeNull();
  expect(fetchMock).toHaveBeenCalledWith('https://example.test/api/tickets/auth/logout', expect.objectContaining({ body: JSON.stringify({ refreshToken: 'refresh' }), headers: expect.objectContaining({ Authorization: 'Bearer access' }) }));
});
it('preserves both credentials when logout fails', async () => {
  const client = new ApiClient('https://example.test/api');
  client.setToken('access', 'refresh');
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: 'Logout unavailable' }), { status: 500 })));
  await expect(client.auth.logout()).rejects.toThrow('Logout unavailable');
  expect(localStorage.getItem('keshless_tickets_token')).toBe('access');
  expect(localStorage.getItem('keshless_tickets_refresh_token')).toBe('refresh');
});
