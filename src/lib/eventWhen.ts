import { format } from 'date-fns';

/**
 * Canonical event date/time formatting.
 *
 * `startTime`/`endTime` are the authoritative instants (stored UTC). `eventDate`
 * is a DATE-ONLY marker stored as midnight UTC — reading a clock time off it
 * renders as "2:00 AM" in Eswatini (UTC+2), which was the long-standing bug.
 * So every human-facing time here comes from `startTime`/`endTime`, and the
 * date is derived from `startTime` too (its local calendar date), never from
 * `eventDate`. Formatting uses the viewer's local timezone (Eswatini for our
 * users), so the displayed time matches the local time the organizer entered.
 */
interface EventWhen {
  eventDate: string;
  startTime: string;
  endTime: string;
  isMultiDay?: boolean;
}

/** "Aug 15, 2026 • 9:00 AM – 5:00 PM" (single day) or
 *  "Aug 15, 2026, 9:00 AM – Aug 16, 2026, 5:30 PM" (multi-day). */
export function formatEventDateTimeRange(event: EventWhen): string {
  const start = new Date(event.startTime || event.eventDate);
  const end = new Date(event.endTime || event.startTime || event.eventDate);
  if (event.isMultiDay) {
    return `${format(start, 'PPp')} – ${format(end, 'PPp')}`;
  }
  return `${format(start, 'PPP')} • ${format(start, 'p')} – ${format(end, 'p')}`;
}
