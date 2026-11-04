import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../api';
import type { StockScope } from '@/lib/stockScope';

// The cross-repo contract: the exact URL and body the dashboard sends for
// each scope — what the API's event routes (/tickets/merchants…,
// /tickets/products/:id) and venue routes (/tickets/venue/…) match on.
// Same harness as salesApi.test.ts: api.ts builds a singleton at module load
// and its constructor reads localStorage, which the 'node' environment lacks.
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
/** request() prefixes every endpoint with the client's base URL. */
let base: string;

beforeAll(async () => {
  vi.stubGlobal('localStorage', new FakeStorage());
  ({ apiClient } = await import('../api'));
  base = (apiClient as unknown as { baseUrl: string }).baseUrl;
});

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.stubGlobal('localStorage', new FakeStorage());
  localStorage.setItem('keshless_tickets_token', 'tok-1');
  // request() logs every call; keep the run quiet.
  vi.spyOn(console, 'log').mockImplementation(() => {});
  // The API wraps every payload in { data }; request() unwraps it.
  fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK', json: async () => ({ data: {} }) } as Response);
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const EVENT: StockScope = { kind: 'event', eventId: 'e1' };
const VENUE: StockScope = { kind: 'venue' };

/** The one fetch a call made: its URL, method, parsed body and auth header. */
function sent() {
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  const headers = init.headers as Record<string, string>;
  return {
    url,
    method: init.method ?? 'GET',
    body: init.body == null ? undefined : JSON.parse(String(init.body)),
    auth: headers['Authorization'],
  };
}

describe('stall routes per scope', () => {
  it('merchants.list', async () => {
    await apiClient.merchants.list(EVENT);
    expect(sent()).toMatchObject({ url: `${base}/tickets/merchants?eventId=e1`, method: 'GET', auth: 'Bearer tok-1' });
    fetchMock.mockClear();
    await apiClient.merchants.list(VENUE);
    expect(sent()).toMatchObject({ url: `${base}/tickets/venue/stalls`, method: 'GET' });
  });

  it('merchants.create: the event body names its event, the venue body does not', async () => {
    await apiClient.merchants.create(EVENT, { name: 'Main Bar', commissionPercent: 5 });
    expect(sent()).toEqual({
      url: `${base}/tickets/merchants`, method: 'POST', auth: 'Bearer tok-1',
      body: { eventId: 'e1', name: 'Main Bar', commissionPercent: 5 },
    });
    fetchMock.mockClear();
    await apiClient.merchants.create(VENUE, { name: 'Main Bar' });
    expect(sent()).toEqual({
      url: `${base}/tickets/venue/stalls`, method: 'POST', auth: 'Bearer tok-1',
      body: { name: 'Main Bar' },
    });
  });

  it.each([
    ['merchants.update', () => apiClient.merchants.update(EVENT, 'm1', { name: 'x' }), () => apiClient.merchants.update(VENUE, 'm1', { name: 'x' }),
      '/tickets/merchants/m1', '/tickets/venue/stalls/m1', 'PATCH'],
    ['merchants.transactions', () => apiClient.merchants.transactions(EVENT, 'm1'), () => apiClient.merchants.transactions(VENUE, 'm1'),
      '/tickets/merchants/m1/transactions?limit=100', '/tickets/venue/stalls/m1/transactions?limit=100', 'GET'],
    ['merchantOperators.list', () => apiClient.merchantOperators.list(EVENT, 'm1'), () => apiClient.merchantOperators.list(VENUE, 'm1'),
      '/tickets/merchants/m1/operators', '/tickets/venue/stalls/m1/operators', 'GET'],
    ['merchantOperators.create', () => apiClient.merchantOperators.create(EVENT, 'm1', { fullName: 'Nomsa' }), () => apiClient.merchantOperators.create(VENUE, 'm1', { fullName: 'Nomsa' }),
      '/tickets/merchants/m1/operators', '/tickets/venue/stalls/m1/operators', 'POST'],
    ['merchantOperators.update', () => apiClient.merchantOperators.update(EVENT, 'o1', { fullName: 'x' }), () => apiClient.merchantOperators.update(VENUE, 'o1', { fullName: 'x' }),
      '/tickets/merchant-operators/o1', '/tickets/venue/operators/o1', 'PATCH'],
    ['merchantOperators.resetPin', () => apiClient.merchantOperators.resetPin(EVENT, 'o1'), () => apiClient.merchantOperators.resetPin(VENUE, 'o1'),
      '/tickets/merchant-operators/o1/reset-pin', '/tickets/venue/operators/o1/reset-pin', 'POST'],
  ] as const)('%s', async (_name, eventCall, venueCall, eventPath, venuePath, method) => {
    await eventCall();
    expect(sent()).toMatchObject({ url: `${base}${eventPath}`, method });
    fetchMock.mockClear();
    await venueCall();
    expect(sent()).toMatchObject({ url: `${base}${venuePath}`, method });
  });
});

describe('stock routes per scope', () => {
  it('stock.updateProduct', async () => {
    await apiClient.stock.updateProduct(EVENT, 'p1', { price: 2700 });
    expect(sent()).toEqual({ url: `${base}/tickets/products/p1`, method: 'PATCH', auth: 'Bearer tok-1', body: { price: 2700 } });
    fetchMock.mockClear();
    await apiClient.stock.updateProduct(VENUE, 'p1', { price: 2700 });
    expect(sent()).toEqual({ url: `${base}/tickets/venue/products/p1`, method: 'PATCH', auth: 'Bearer tok-1', body: { price: 2700 } });
  });

  it('a venue reconciliation carries its range, offset encoded', async () => {
    await apiClient.stock.reconciliation(VENUE, { from: '2026-10-01T00:00:00+02:00', to: '2026-10-02T00:00:00+02:00' });
    expect(sent().url).toBe(
      `${base}/tickets/venue/stock/reconciliation?from=2026-10-01T00%3A00%3A00%2B02%3A00&to=2026-10-02T00%3A00%3A00%2B02%3A00`,
    );
  });

  it('an event reconciliation carries no range', async () => {
    await apiClient.stock.reconciliation(EVENT);
    expect(sent().url).toBe(`${base}/tickets/events/e1/stock/reconciliation`);
  });

  it('unwraps the { data } envelope', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, statusText: 'OK', json: async () => ({ data: [{ _id: 'm1' }] }) } as Response);
    expect(await apiClient.merchants.list(VENUE)).toEqual([{ _id: 'm1' }]);
  });
});
