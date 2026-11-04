import type { Organizer, OrganizerType } from '@/types';

/** The open tab: every account, or one account type. */
export type OrganizerTab = 'all' | OrganizerType;

// Everything a tab says about itself: its label, the first stat card, and what
// an empty table reads when nothing is filtered.
export const ORGANIZER_TABS: {
  value: OrganizerTab;
  label: string;
  total: { title: string; description: string };
  empty: string;
}[] = [
  { value: 'all', label: 'All', total: { title: 'Total organizers', description: 'All registered organizer accounts' }, empty: 'No organizers yet.' },
  { value: 'events', label: 'Event organizers', total: { title: 'Event organizers', description: 'Accounts that run events' }, empty: 'No event organizers yet.' },
  { value: 'venues', label: 'Venues', total: { title: 'Venues', description: 'Bars, restaurants and lounges' }, empty: 'No venues yet.' },
  { value: 'services', label: 'Businesses', total: { title: 'Businesses', description: 'Service businesses' }, empty: 'No businesses yet.' },
  { value: 'transport', label: 'Bus operators', total: { title: 'Bus operators', description: 'Transport accounts' }, empty: 'No bus operators yet.' },
];

export const tabConfig = (tab: OrganizerTab) => ORGANIZER_TABS.find((t) => t.value === tab)!;

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
