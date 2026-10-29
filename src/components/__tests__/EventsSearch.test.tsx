// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EventsPage } from '@/pages/EventsPage';
import { eventFixture } from '@/test/eventFixture';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { isSuperAdmin: true } }) }));
vi.mock('@/lib/api', () => ({ apiClient: { events: {
  getEvents: vi.fn(async (params: { page?: number }) => ({
    data: params.page === 2 ? [event('past', 'Eswatini Farmers Market', '2020-01-01')] : [event('future', 'Upcoming Summer Festival', '2099-01-01')],
    pagination: { page: params.page ?? 1, limit: 100, total: 2, pages: 2 },
  })),
} } }));
function event(id: string, name: string, date: string) {
  return eventFixture({ _id: id, name, eventDate: date, startTime: date, endTime: date });
}
afterEach(cleanup);
it('preserves All, searches beyond its page and selected tab, and renders navigable dated results', async () => {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><EventsPage /></MemoryRouter></QueryClientProvider>);
  await screen.findByText('Upcoming Summer Festival');
  expect(screen.queryByText('Eswatini Farmers Market')).toBeNull();
  fireEvent.click(screen.getByRole('tab', { name: /Approved/ }));
  const input = screen.getByRole('textbox', { name: 'Search events by name' });
  fireEvent.change(input, { target: { value: '  ESWATINI   farmers market ' } });
  const past = await screen.findByRole('link', { name: /Eswatini Farmers Market/ });
  expect(past.getAttribute('href')).toBe('/events/past');
  expect(past.textContent).toContain('2020');
  expect(past.textContent).toContain('Status: published');
  fireEvent.change(input, { target: { value: 'upcoming summer' } });
  await screen.findByRole('link', { name: /Upcoming Summer Festival/ });
  fireEvent.change(input, { target: { value: 'unmatched event' } });
  await screen.findByText('No events found');
  fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
  await screen.findByText('Upcoming Summer Festival');
  expect(screen.queryByText('Eswatini Farmers Market')).toBeNull();
});
