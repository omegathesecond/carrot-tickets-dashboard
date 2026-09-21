import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../api';

// Same shape as salesApi.test.ts: api.ts builds a singleton at module-load and
// its constructor reads localStorage, which the 'node' test environment doesn't
// have. Polyfill, then dynamic-import.
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

function jsonResponse(body: unknown): Response {
  return { ok: true, status: 200, statusText: 'OK', json: async () => body } as Response;
}

/** Runs `call`, returns the query string of the single fetch it made. */
async function queryOf(call: () => Promise<unknown>): Promise<URLSearchParams> {
  const fetchMock = vi.fn().mockResolvedValue(
    jsonResponse({ data: { tags: [], hasMore: false, nextCursor: null } }),
  );
  vi.stubGlobal('fetch', fetchMock);
  await call();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  return new URL(String(fetchMock.mock.calls[0][0]), 'https://x.test').searchParams;
}

describe('apiClient.tags.list', () => {
  // The bug behind these params: the endpoint sorted newest-registered-first
  // with no balance filter, so at an event that bulk-registers plastic the tags
  // holding money were scattered across every page. The filtering now happens
  // server-side, which is worth nothing if the client never asks for it.
  it('forwards the funded filter and the balance sort', async () => {
    const q = await queryOf(() => apiClient.tags.list('e1', { funded: true, sort: 'balance' }));
    expect(q.get('funded')).toBe('true');
    expect(q.get('sort')).toBe('balance');
  });

  it('sends neither when they are not asked for, leaving the endpoint on its default', async () => {
    const q = await queryOf(() => apiClient.tags.list('e1', {}));
    expect(q.get('funded')).toBeNull();
    expect(q.get('sort')).toBeNull();
  });

  // `funded: false` means "show me everything", which is the ABSENCE of the
  // filter — sending funded=false would work today but only because the server
  // reads it as not-true. Say nothing rather than rely on that.
  it('omits the funded filter when it is switched off', async () => {
    const q = await queryOf(() => apiClient.tags.list('e1', { funded: false, sort: 'recent' }));
    expect(q.get('funded')).toBeNull();
    expect(q.get('sort')).toBe('recent');
  });

  it('still forwards the filters it always did', async () => {
    const q = await queryOf(() =>
      apiClient.tags.list('e1', { status: 'frozen', q: 'UID9', limit: 200, cursor: '9000:64c000000000000000000a01' }),
    );
    expect(q.get('status')).toBe('frozen');
    expect(q.get('q')).toBe('UID9');
    expect(q.get('limit')).toBe('200');
    expect(q.get('cursor')).toBe('9000:64c000000000000000000a01');
  });
});
