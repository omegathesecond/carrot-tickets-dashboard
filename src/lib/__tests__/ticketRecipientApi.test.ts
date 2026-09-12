import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../api';

// Same shape as salesApi.test.ts / updatesApi.test.ts: api.ts builds a
// singleton at module-load and its constructor reads localStorage, which the
// 'node' test environment doesn't have. Polyfill, then dynamic-import.
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

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, statusText: ok ? 'OK' : 'Error', json: async () => body } as Response;
}

describe('apiClient.sales.setTicketRecipient', () => {
  it('PATCHes a recipient to the ticket route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ data: { ticket: { ticketId: 'TKT-1', customerName: 'Thandi', customerPhone: '76111111' } } })
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiClient.sales.setTicketRecipient('TKT-1', { name: 'Thandi', phone: '76111111' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/tickets/TKT-1/recipient');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ name: 'Thandi', phone: '76111111' });
    expect(result).toEqual({ ticket: { ticketId: 'TKT-1', customerName: 'Thandi', customerPhone: '76111111' } });
  });

  it('sends only the fields given — a phone-only patch carries no name/email keys', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ data: { ticket: { ticketId: 'TKT-2', customerPhone: '76111111' } } })
    );
    vi.stubGlobal('fetch', fetchMock);

    await apiClient.sales.setTicketRecipient('TKT-2', { phone: '76111111' });

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ phone: '76111111' });
  });

  it('propagates a validation failure (e.g. 400 on a bad phone) rather than swallowing it', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ message: 'Invalid phone number' }, false, 400)
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      apiClient.sales.setTicketRecipient('TKT-3', { phone: 'not-a-phone' })
    ).rejects.toThrow('Invalid phone number');
  });
});

describe('apiClient.sales.sendTicket', () => {
  it('POSTs the chosen channel to the send route and nothing else', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: { sent: true } }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await apiClient.sales.sendTicket('TKT-1', 'email');

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/tickets/TKT-1/send');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ channel: 'email' });
    expect(res.sent).toBe(true);
  });

  it('supports the sms channel too', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: { sent: true } }));
    vi.stubGlobal('fetch', fetchMock);

    await apiClient.sales.sendTicket('TKT-1', 'sms');

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ channel: 'sms' });
  });
});

describe('apiClient.ticketDocs.ticketPdfBytes', () => {
  it('GETs the single-ticket PDF route and returns a Blob, bypassing the JSON envelope', async () => {
    const fakeBlob = { type: 'application/pdf' } as Blob;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      blob: async () => fakeBlob,
      // No `json` needed on success — fetchPdf must not call response.json()
      // on the happy path, since a PDF body is not JSON.
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiClient.ticketDocs.ticketPdfBytes('TKT-1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/tickets/TKT-1/pdf/download');
    expect(init.method).toBe('GET');
    expect(result).toBe(fakeBlob);
  });

  it('throws with the server message when the PDF route errors (e.g. 409 still generating)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ message: 'Ticket PDF is still generating' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiClient.ticketDocs.ticketPdfBytes('TKT-1')).rejects.toThrow('Ticket PDF is still generating');
  });
});

describe('apiClient.ticketDocs.ticketBundlePdf', () => {
  it('POSTs the ticketIds array to the bundle route and returns a Blob', async () => {
    const fakeBlob = { type: 'application/pdf' } as Blob;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      blob: async () => fakeBlob,
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiClient.ticketDocs.ticketBundlePdf(['TKT-1', 'TKT-2']);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/tickets/pdf-bundle');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ ticketIds: ['TKT-1', 'TKT-2'] });
    expect(result).toBe(fakeBlob);
  });
});
