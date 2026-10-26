// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { GateOperatorsPage } from '@/pages/GateOperatorsPage';

const state = vi.hoisted(() => ({ user: { _id: 'a', isSuperAdmin: true }, list: vi.fn() }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock('@/lib/api', () => ({ apiClient: { gateOperators: { list: (...args: unknown[]) => state.list(...args) } } }));
vi.mock('@/components/EventPicker', () => ({ EventPicker: () => null }));
vi.mock('@/components/OperatorEventsDialog', () => ({ OperatorEventsDialog: () => null }));
vi.mock('@/components/OperatorGrantsField', () => ({ OperatorGrantsField: () => null }));
afterEach(cleanup);

const operator = (name: string) => ({ _id: name, fullName: name, scope: 'organizer',
  vendorId: 'v', eventIds: [], isActive: true, grants: [], loginCode: '123456' });

function setup(url = '/gate-operators') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  const tree = () => <QueryClientProvider client={client}><MemoryRouter initialEntries={[url]}><GateOperatorsPage /></MemoryRouter></QueryClientProvider>;
  const view = render(tree());
  return () => view.rerender(tree());
}

describe('gate operator list context', () => {
  it('sends the selected organizer and event to the API', async () => {
    state.user = { _id: 'a', isSuperAdmin: true };
    state.list.mockResolvedValue([]);
    setup('/gate-operators?vendorId=organizer-a&eventId=event-a');
    await waitFor(() => expect(state.list).toHaveBeenCalledWith({ vendorId: 'organizer-a', eventId: 'event-a' }));
  });

  it('does not reuse the previous account’s operators when the account changes', async () => {
    state.user = { _id: 'a', isSuperAdmin: true };
    state.list.mockResolvedValue([operator('Alice')]);
    const rerender = setup();
    await screen.findByText('Alice');
    state.user = { _id: 'b', isSuperAdmin: true };
    state.list.mockResolvedValue([operator('Bob')]);
    rerender();
    expect(screen.queryByText('Alice')).toBeNull();
    await screen.findByText('Bob');
  });

  it('surfaces a list failure instead of showing an empty successful list', async () => {
    state.list.mockRejectedValue(new Error('Organizer access denied'));
    setup();
    expect((await screen.findByRole('alert')).textContent).toContain('Organizer access denied');
    expect(screen.queryByText('No gate operators yet')).toBeNull();
  });
});
