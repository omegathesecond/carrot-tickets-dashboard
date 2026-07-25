import { it, expect, vi, beforeEach } from 'vitest';
import { submitNewEvent } from '@/lib/createEvent';
import { apiClient } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  apiClient: { events: {
    createEvent: vi.fn(),
    uploadPoster: vi.fn(),
    uploadGalleryImages: vi.fn(),
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
  expect(res).toEqual({ event: { _id: 'ev1' }, uploadError: null });
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
