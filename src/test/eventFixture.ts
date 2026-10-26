import type { Event } from '@/types';

export function eventFixture(overrides: Partial<Event>): Event {
  return {
    _id: 'event', eventId: 'event', vendorId: 'organizer', name: 'Event',
    category: 'events', venue: 'Eswatini', eventDate: '2099-01-01',
    startTime: '2099-01-01', endTime: '2099-01-01', status: 'published',
    capacity: 100, ticketTypes: [], totalTicketsSold: 0, totalRevenue: 0,
    createdAt: '2020-01-01', updatedAt: '2020-01-01', ...overrides,
  };
}
