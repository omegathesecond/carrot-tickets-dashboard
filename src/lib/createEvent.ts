import { apiClient } from '@/lib/api';
import type { Event, EventFormData } from '@/types';

export interface NewEventMedia {
  poster?: File | null;
  gallery?: File[];
}

export interface CreateEventResult {
  event: Event;
  uploadError: string | null;
}

/**
 * Two-phase "list an event": create the event, then upload the picked poster +
 * gallery to the returned id (the media endpoints are keyed by eventId, which
 * doesn't exist until the event is created).
 *
 * A create failure rejects — nothing was uploaded. An upload failure does NOT
 * reject: the event already exists, so we keep it and return `uploadError` so
 * the caller can surface a loud "created, but images didn't upload" message
 * (never a silent fallback).
 */
export async function submitNewEvent(
  data: EventFormData,
  media: NewEventMedia,
): Promise<CreateEventResult> {
  const event = await apiClient.events.createEvent(data);
  let uploadError: string | null = null;
  try {
    if (media.poster) {
      await apiClient.events.uploadPoster(event._id, media.poster);
    }
    if (media.gallery && media.gallery.length > 0) {
      await apiClient.events.uploadGalleryImages(event._id, media.gallery);
    }
  } catch (err: any) {
    uploadError = err?.message || 'Image upload failed';
  }
  return { event, uploadError };
}
