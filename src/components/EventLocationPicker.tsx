import { useId } from 'react';
import { parseEventLocation, type LocationDraft } from '@/lib/eventLocation';

/** Use the existing keyless Google Maps provider. Coordinates are chosen by
 * the organizer, never inferred from venue text or the viewer's position. */
export function EventLocationPicker({ value, onChange }: { value: LocationDraft; onChange: (value: LocationDraft) => void }) {
  const id = useId();
  let point: { lat: number; lng: number } | null = null;
  try { point = parseEventLocation(value); } catch { /* Partial input is validated on submit. */ }
  return <fieldset className="space-y-3">
    <legend className="text-sm font-semibold">Event map location</legend>
    <p className="text-sm text-muted-foreground">Choose the venue in Google Maps, then copy its latitude and longitude here. Leave both blank if the location is unavailable; this event will not appear in Nearby.</p>
    <a className="text-sm underline" href="https://www.google.com/maps" target="_blank" rel="noopener noreferrer">Choose venue in Google Maps</a>
    <div className="grid grid-cols-2 gap-3">
      {(['lat', 'lng'] as const).map((key) => <label key={key} htmlFor={`${id}-${key}`} className="space-y-1 text-sm">
        <span>{key === 'lat' ? 'Latitude' : 'Longitude'}</span>
        <input id={`${id}-${key}`} type="number" step="any" min={key === 'lat' ? -90 : -180} max={key === 'lat' ? 90 : 180}
          className="w-full rounded-md border border-input bg-background px-3 py-2" value={value[key]}
          onChange={(e) => onChange({ ...value, [key]: e.target.value })} />
      </label>)}
    </div>
    {point ? <iframe title="Selected event location" className="h-56 w-full rounded-xl border" loading="lazy"
      src={`https://maps.google.com/maps?q=${point.lat},${point.lng}&output=embed`} /> :
      <p className="text-sm text-muted-foreground">Event location unavailable.</p>}
  </fieldset>;
}
