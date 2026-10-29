import type { Event, EventQueryParams, PaginatedResponse } from '@/types';

export function normalizeEventSearch(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

// Fetch every page without a date/status filter. Keep the normal tab query intact.
export async function loadSearchEvents(
  getEvents: (params: EventQueryParams) => Promise<PaginatedResponse<Event>>,
): Promise<Event[]> {
  const first = await getEvents({ page: 1, limit: 100 });
  const remaining = await Promise.all(
    Array.from({ length: Math.max(0, first.pagination.pages - 1) }, (_, index) =>
      getEvents({ page: index + 2, limit: 100 }),
    ),
  );
  return [first, ...remaining].flatMap((page) => page.data);
}
