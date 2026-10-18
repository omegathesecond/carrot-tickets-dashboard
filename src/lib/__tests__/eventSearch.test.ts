import { describe, expect, it, vi } from 'vitest';
import { loadSearchEvents, normalizeEventSearch } from '../eventSearch';
import { eventFixture } from '@/test/eventFixture';

describe('event search', () => {
  it('loads past and archived events beyond the upcoming first page', async () => {
    const upcoming = eventFixture({ _id: 'upcoming', name: 'Upcoming Summer Festival', status: 'published', eventDate: '2099-12-01' });
    const past = eventFixture({ _id: 'past', name: 'Eswatini Farmers Market', status: 'completed', eventDate: '2020-01-01' });
    const archived = eventFixture({ _id: 'archived', name: 'Archived Market', status: 'completed', eventDate: '2019-01-01' });
    const getEvents = vi.fn()
      .mockResolvedValueOnce({ data: [upcoming], pagination: { pages: 2 } })
      .mockResolvedValueOnce({ data: [past, archived], pagination: { pages: 2 } });
    const events = await loadSearchEvents(getEvents);
    const search = (query: string) => events.filter(event => normalizeEventSearch(event.name).includes(normalizeEventSearch(query)));
    expect(search('  eSWATINI   FARMERS   market ')).toEqual([past]);
    expect(search('upcoming summer')).toEqual([upcoming]);
    expect(search('archived')).toEqual([archived]);
    expect(search('nonexistent')).toEqual([]);
    expect(getEvents.mock.calls).toEqual([[{ page: 1, limit: 100 }], [{ page: 2, limit: 100 }]]);
  });

  it('normalizes repeated spaces in stored names too', () => {
    expect(normalizeEventSearch(' Eswatini   Farmers\tMarket ')).toBe('eswatini farmers market');
  });

  it('propagates a failed page instead of presenting partial success', async () => {
    const getEvents = vi.fn()
      .mockResolvedValueOnce({ data: [], pagination: { pages: 2 } })
      .mockRejectedValueOnce(new Error('Unavailable'));
    await expect(loadSearchEvents(getEvents)).rejects.toThrow('Unavailable');
  });
});
