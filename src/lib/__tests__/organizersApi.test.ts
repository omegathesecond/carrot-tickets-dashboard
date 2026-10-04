import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../api';

// Same harness as salesApi.test.ts: api.ts builds a singleton at module-load
// and its constructor reads localStorage, which the 'node' test environment
// doesn't have. Polyfill, then dynamic-import.
class FakeStorage {
  private store: Record<string, string> = {};
  getItem(key: string): string | null {
    return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
  }
  setItem(key: string, value: string): void { this.store[key] = value; }
  removeItem(key: string): void { delete this.store[key]; }
  clear(): void { this.store = {}; }
}

let apiClient: ApiClient;

beforeAll(async () => {
  vi.stubGlobal('localStorage', new FakeStorage());
  ({ apiClient } = await import('../api'));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.stubGlobal('localStorage', new FakeStorage());
});

/** Runs `call`, returns the single URL it fetched. */
async function urlOf(call: () => Promise<unknown>): Promise<URL> {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK', json: async () => ({ data: {} }) } as Response);
  vi.stubGlobal('fetch', fetchMock);
  await call();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  return new URL(String(fetchMock.mock.calls[0][0]), 'https://x.test');
}

describe('apiClient.organizers.list', () => {
  it('sends exactly the filters it is given, as the API\'s query params', async () => {
    const u = await urlOf(() => apiClient.organizers.list({
      search: 'glow', status: 'pending', type: 'services', category: 'beauty_and_wellness', sort: 'name', page: 2, limit: 25,
    }));
    expect(u.pathname.endsWith('/tickets/admin/organizers')).toBe(true);
    expect(Object.fromEntries(u.searchParams)).toEqual({
      search: 'glow', status: 'pending', type: 'services', category: 'beauty_and_wellness', sort: 'name', page: '2', limit: '25',
    });
  });

  it('sends venueTrading for the Venues tab', async () => {
    const u = await urlOf(() => apiClient.organizers.list({ type: 'venues', venueTrading: 'none' }));
    expect(Object.fromEntries(u.searchParams)).toEqual({ type: 'venues', venueTrading: 'none' });
  });

  it('omits absent and empty filters rather than sending empty values', async () => {
    const u = await urlOf(() => apiClient.organizers.list({ search: '', status: undefined, type: undefined, venueTrading: undefined, category: undefined }));
    expect(u.search).toBe('');
  });
});
