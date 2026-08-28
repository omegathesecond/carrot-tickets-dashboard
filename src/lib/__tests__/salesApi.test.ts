import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../api';

// Same shape as updatesApi.test.ts: api.ts builds a singleton at module-load
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

function jsonResponse(body: unknown): Response {
  return { ok: true, status: 200, statusText: 'OK', json: async () => body } as Response;
}

/** Runs `call`, returns the query string of the single fetch it made. */
async function queryOf(call: () => Promise<unknown>): Promise<URLSearchParams> {
  const fetchMock = vi.fn().mockResolvedValue(
    jsonResponse({ data: { data: [], pagination: { page: 1, limit: 25, total: 0, pages: 0 } } }),
  );
  vi.stubGlobal('fetch', fetchMock);
  await call();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  return new URL(String(fetchMock.mock.calls[0][0]), 'https://x.test').searchParams;
}

describe('apiClient.sales.getSales', () => {
  it('forwards paging so a page beyond the first is reachable', async () => {
    const q = await queryOf(() => apiClient.sales.getSales({ page: 3, limit: 25 }));
    expect(q.get('page')).toBe('3');
    expect(q.get('limit')).toBe('25');
  });

  // The bug: the Sales History page has always built `channel` into its filter
  // params and the API has always supported it (ticketSalesQuerySchema
  // validates it; TicketService.getSales does `if (channel) filter.channel`),
  // but this client dropped it on the floor — so picking "Reseller POS"
  // silently returned every channel.
  it('forwards the channel filter', async () => {
    const q = await queryOf(() => apiClient.sales.getSales({ channel: 'reseller_pos' }));
    expect(q.get('channel')).toBe('reseller_pos');
  });

  it('forwards every other filter the page can set', async () => {
    const q = await queryOf(() => apiClient.sales.getSales({
      eventId: '507f1f77bcf86cd799439011',
      paymentMethod: 'mtn_momo',
      paymentStatus: 'completed',
      startDate: '2026-08-01',
      endDate: '2026-08-28',
    }));
    expect(q.get('eventId')).toBe('507f1f77bcf86cd799439011');
    expect(q.get('paymentMethod')).toBe('mtn_momo');
    expect(q.get('paymentStatus')).toBe('completed');
    expect(q.get('startDate')).toBe('2026-08-01');
    expect(q.get('endDate')).toBe('2026-08-28');
  });

  it('omits absent filters rather than sending empty values', async () => {
    const q = await queryOf(() => apiClient.sales.getSales({ page: 1 }));
    for (const key of ['channel', 'eventId', 'paymentMethod', 'paymentStatus']) {
      expect(q.has(key), key).toBe(false);
    }
  });
});

describe('apiClient.exports.exportSalesCSV', () => {
  // Downloading goes through fetch + a blob URL, so stub what jsdom-less 'node'
  // doesn't have and just inspect the request URL.
  async function exportQueryOf(params: Parameters<typeof apiClient.exports.exportSalesCSV>[0]) {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200, statusText: 'OK',
      blob: async () => ({ type: 'text/csv' }),
      headers: { get: () => 'attachment; filename="sales.csv"' },
    });
    vi.stubGlobal('fetch', fetchMock);
    // The download path uses `window.URL` and a detached <a>, neither of which
    // the 'node' test environment has.
    vi.stubGlobal('window', { URL: { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} } });
    vi.stubGlobal('document', {
      createElement: () => ({ click: () => {}, setAttribute: () => {}, style: {}, remove: () => {} }),
      body: { appendChild: () => {}, removeChild: () => {} },
    });

    await apiClient.exports.exportSalesCSV(params);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    return new URL(String(fetchMock.mock.calls[0][0])).searchParams;
  }

  // The export is a whole-result-set download. It used to send only eventId +
  // dates, so filtering to (say) reseller-POS MoMo sales and hitting Export CSV
  // silently produced a file containing every channel and method.
  it('forwards the same filters the table is showing', async () => {
    const q = await exportQueryOf({
      eventId: '507f1f77bcf86cd799439011',
      paymentMethod: 'mtn_momo',
      paymentStatus: 'completed',
      channel: 'reseller_pos',
      startDate: '2026-08-01',
      endDate: '2026-08-28',
    });

    expect(q.get('eventId')).toBe('507f1f77bcf86cd799439011');
    expect(q.get('paymentMethod')).toBe('mtn_momo');
    expect(q.get('paymentStatus')).toBe('completed');
    expect(q.get('channel')).toBe('reseller_pos');
    expect(q.get('startDate')).toBe('2026-08-01');
    expect(q.get('endDate')).toBe('2026-08-28');
  });

  // Paging is the visible page, not the export. A CSV limited to the 25 rows
  // on screen would be a silent, invisible truncation of a download people
  // reconcile their money against.
  it('never sends paging — the CSV is the whole result set', async () => {
    const q = await exportQueryOf({ page: 3, limit: 25, eventId: '507f1f77bcf86cd799439011' });
    expect(q.has('page')).toBe(false);
    expect(q.has('limit')).toBe(false);
  });
});
