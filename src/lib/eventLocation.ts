export type LocationDraft = { lat: string; lng: string };
export const emptyLocation: LocationDraft = { lat: '', lng: '' };
export function parseEventLocation(draft: LocationDraft): { lat: number; lng: number } | null {
  if (!draft.lat.trim() && !draft.lng.trim()) return null;
  const lat = Number(draft.lat), lng = Number(draft.lng);
  if (!draft.lat.trim() || !draft.lng.trim() || !Number.isFinite(lat) || !Number.isFinite(lng) ||
      lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new Error('Enter both valid coordinates: latitude −90 to 90 and longitude −180 to 180.');
  }
  return { lat, lng };
}
