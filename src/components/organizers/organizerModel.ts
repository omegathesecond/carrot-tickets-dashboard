import type { Organizer, OrganizerType } from '@/types';

/** The open tab: every account, or one account type. */
export type OrganizerTab = 'all' | OrganizerType;

export const ORGANIZER_TABS: { value: OrganizerTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'events', label: 'Event organizers' },
  { value: 'venues', label: 'Venues' },
  { value: 'services', label: 'Businesses' },
  { value: 'transport', label: 'Bus operators' },
];

/** The tab named by `?type=`; no (or an unrecognised) param is the All tab. */
export function parseOrganizerTab(raw: string | null): OrganizerTab {
  return ORGANIZER_TABS.find((t) => t.value === raw)?.value ?? 'all';
}

export function humanize(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// A services or transport account never holds the venue permission, so the API
// refuses to switch venue trading on for one (409) — don't offer it. Accounts
// that already have a venue keep their suspend / reactivate actions regardless.
const NO_VENUE_OPERATOR_TYPES = ['services', 'transport'];
export const canSwitchOnVenue = (o: Organizer) => !NO_VENUE_OPERATOR_TYPES.includes(o.operatorType ?? '');
