import { LANDING_URL } from '@/lib/constants';

/**
 * SEO-friendly public event URLs: {LANDING_URL}/event/<name-slug>-<mongo-id>.
 * Must stay in sync with the website's slug format (landing/src/lib/eventUrl.ts):
 * the buyer site resolves the event by the trailing 24-hex id, so the slug is
 * purely cosmetic and plain-id links keep working.
 */
export function slugifyEventName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents left over from NFKD
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
}

export function publicEventUrl(event: { _id: string; name: string }): string {
  const slug = slugifyEventName(event.name);
  return slug
    ? `${LANDING_URL}/event/${slug}-${event._id}`
    : `${LANDING_URL}/event/${event._id}`;
}
