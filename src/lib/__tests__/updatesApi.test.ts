import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../api';

// api.ts instantiates a singleton `apiClient` at module-load time, and its
// constructor reads `localStorage` directly — there's no DOM/localStorage in
// this project's Vitest environment ('node', see vitest.config.ts). Polyfill
// a minimal Storage before dynamically importing the module, rather than
// switching the whole suite to jsdom just for this one client.
class FakeStorage {
  private store: Record<string, string> = {};
  getItem(key: string): string | null {
    return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
  }
  setItem(key: string, value: string): void {
    this.store[key] = value;
  }
  removeItem(key: string): void {
    delete this.store[key];
  }
  clear(): void {
    this.store = {};
  }
}

let apiClient: ApiClient;

beforeAll(async () => {
  vi.stubGlobal('localStorage', new FakeStorage());
  ({ apiClient } = await import('../api'));
});

afterEach(() => {
  vi.unstubAllGlobals();
  // Re-stub localStorage since unstubAllGlobals tears it down too, and later
  // request() calls (getToken/getRefreshToken) read it on every call.
  vi.stubGlobal('localStorage', new FakeStorage());
});

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: async () => body,
  } as Response;
}

describe('apiClient.updates.init', () => {
  it('POSTs to /tickets/updates and returns { updateId, uploadUrl }', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ data: { updateId: 'upd_1', uploadUrl: 'https://r2.example.com/signed-put' } })
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiClient.updates.init({
      kind: 'image',
      caption: 'Doors open at 7pm!',
      ext: 'jpg',
      contentType: 'image/jpeg',
    });

    expect(result).toEqual({ updateId: 'upd_1', uploadUrl: 'https://r2.example.com/signed-put' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/tickets\/updates$/);
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({
      kind: 'image',
      caption: 'Doors open at 7pm!',
      ext: 'jpg',
      contentType: 'image/jpeg',
    });
  });
});

describe('apiClient.updates.uploadToR2', () => {
  it('does a raw PUT with the file as the body and no Authorization/x-api-key headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, true, 200));
    vi.stubGlobal('fetch', fetchMock);

    const file = new File(['binary-bytes'], 'clip.mp4', { type: 'video/mp4' });
    await apiClient.updates.uploadToR2('https://r2.example.com/signed-put', file);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('https://r2.example.com/signed-put');
    expect(opts.method).toBe('PUT');
    expect(opts.body).toBe(file);
    expect(opts.headers).toEqual({ 'Content-Type': 'video/mp4' });
    expect(opts.headers.Authorization).toBeUndefined();
    expect(opts.headers['x-api-key']).toBeUndefined();
  });

  it('throws when the R2 PUT fails (fail loud, no silent success)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, false, 403));
    vi.stubGlobal('fetch', fetchMock);

    const file = new File(['x'], 'a.png', { type: 'image/png' });
    await expect(apiClient.updates.uploadToR2('https://r2.example.com/signed-put', file)).rejects.toThrow();
  });
});

describe('apiClient.updates.finalize / getPublic', () => {
  it('finalize POSTs to /tickets/updates/:id/finalize and unwraps the media DTO', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: { media: { status: 'ready' } } }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiClient.updates.finalize('upd_1');

    expect(result).toEqual({ media: { status: 'ready' } });
    const [url, opts] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/tickets\/updates\/upd_1\/finalize$/);
    expect(opts.method).toBe('POST');
  });

  it('getPublic reads /public/updates/:id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ data: { media: { status: 'failed', error: 'transcode error' } } })
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiClient.updates.getPublic('upd_1');

    expect(result).toEqual({ media: { status: 'failed', error: 'transcode error' } });
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/public\/updates\/upd_1$/);
  });
});
