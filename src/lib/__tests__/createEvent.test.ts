import { it, expect, vi, beforeEach } from 'vitest';
import { submitNewEvent } from '@/lib/createEvent';
import { apiClient } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  apiClient: { events: {
    createEvent: vi.fn(),
    uploadPoster: vi.fn(),
    uploadGalleryImages: vi.fn(),
    requestCashless: vi.fn(),
  } },
}));

const data = { name: 'E', venue: 'V', eventDate: '2026-08-01', startTime: 's', endTime: 'e', ticketTypes: [] } as any;
const poster = new File(['x'], 'p.png', { type: 'image/png' });
const gallery = [new File(['y'], 'g.png', { type: 'image/png' })];

beforeEach(() => vi.clearAllMocks());

it('creates then uploads poster + gallery to the new event id', async () => {
  (apiClient.events.createEvent as any).mockResolvedValue({ _id: 'ev1' });
  (apiClient.events.uploadPoster as any).mockResolvedValue({});
  (apiClient.events.uploadGalleryImages as any).mockResolvedValue({});

  const res = await submitNewEvent(data, { poster, gallery });

  expect(apiClient.events.createEvent).toHaveBeenCalledWith(data);
  expect(apiClient.events.uploadPoster).toHaveBeenCalledWith('ev1', poster);
  expect(apiClient.events.uploadGalleryImages).toHaveBeenCalledWith('ev1', gallery);
  expect(res).toEqual({ event: { _id: 'ev1' }, uploadError: null, cashlessError: null });
});

it('keeps the event but reports uploadError when a upload fails', async () => {
  (apiClient.events.createEvent as any).mockResolvedValue({ _id: 'ev2' });
  (apiClient.events.uploadPoster as any).mockRejectedValue(new Error('R2 down'));

  const res = await submitNewEvent(data, { poster, gallery: [] });

  expect(res.event).toEqual({ _id: 'ev2' });
  expect(res.uploadError).toMatch(/R2 down/);
});

it('propagates a create failure (no event, no uploads)', async () => {
  (apiClient.events.createEvent as any).mockRejectedValue(new Error('bad request'));
  await expect(submitNewEvent(data, {})).rejects.toThrow('bad request');
  expect(apiClient.events.uploadPoster).not.toHaveBeenCalled();
});

// ── Cashless request phase ────────────────────────────────────────────────
// An organizer cannot set `cashless` themselves (the API 403s), so asking for
// it is a second call against the id create just returned — the same reason
// the media uploads are a second phase.

it('does not ask for cashless unless the caller requested it', async () => {
  (apiClient.events.createEvent as any).mockResolvedValue({ _id: 'ev1' });

  await submitNewEvent(data, {});

  expect(apiClient.events.requestCashless).not.toHaveBeenCalled();
});

it('requests cashless against the new event id, passing the note', async () => {
  (apiClient.events.createEvent as any).mockResolvedValue({ _id: 'ev1' });
  (apiClient.events.requestCashless as any).mockResolvedValue({});

  const res = await submitNewEvent(data, {}, { note: 'two bars' });

  expect(apiClient.events.requestCashless).toHaveBeenCalledWith('ev1', 'two bars');
  expect(res.cashlessError).toBeNull();
});

it('sends no note when none was given', async () => {
  (apiClient.events.createEvent as any).mockResolvedValue({ _id: 'ev1' });
  (apiClient.events.requestCashless as any).mockResolvedValue({});

  await submitNewEvent(data, {}, {});

  expect(apiClient.events.requestCashless).toHaveBeenCalledWith('ev1', undefined);
});

it('keeps the event and reports cashlessError when the request fails', async () => {
  (apiClient.events.createEvent as any).mockResolvedValue({ _id: 'ev1' });
  (apiClient.events.requestCashless as any).mockRejectedValue(new Error('Event not found'));

  // Must NOT reject: the event exists. Rejecting would tell the organizer
  // their event failed to create, which is false and unrecoverable in the UI.
  const res = await submitNewEvent(data, {}, { note: 'x' });

  expect(res.event).toEqual({ _id: 'ev1' });
  expect(res.cashlessError).toBe('Event not found');
});

it('reports an upload failure and a cashless failure independently', async () => {
  (apiClient.events.createEvent as any).mockResolvedValue({ _id: 'ev1' });
  (apiClient.events.uploadPoster as any).mockRejectedValue(new Error('upload died'));
  (apiClient.events.requestCashless as any).mockRejectedValue(new Error('request died'));

  const res = await submitNewEvent(data, { poster }, { note: 'x' });

  expect(res.uploadError).toBe('upload died');
  expect(res.cashlessError).toBe('request died');
});
