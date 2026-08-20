// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { EventRegisterPanel } from '@/components/cashless/EventRegisterPanel';

afterEach(cleanup);

const listOperators = vi.fn();
const createOperator = vi.fn();
const listRegistrations = vi.fn();
vi.mock('@/lib/api', () => ({
  apiClient: {
    gateOperators: {
      list: () => listOperators(),
      create: (...a: unknown[]) => createOperator(...a),
      resetPin: vi.fn(),
      setActive: vi.fn(),
    },
    tags: { registrations: (...a: unknown[]) => listRegistrations(...a) },
  },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const operator = (over: Record<string, unknown> = {}) => ({
  _id: 'op1', fullName: 'Register Rose', scope: 'organizer', eventIds: ['e1'],
  isActive: true, loginCode: '380443', grants: ['issue_tags'], createdAt: '2026-08-19T10:00:00.000Z',
  ...over,
});

const NO_REGISTRATIONS = { registrations: [], hasMore: false, nextCursor: null };

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <EventRegisterPanel eventId="e1" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('EventRegisterPanel', () => {
  it('lists only the operators who can actually register tags', async () => {
    listOperators.mockResolvedValue([
      operator(),
      operator({ _id: 'op2', fullName: 'Just A Scanner', grants: [] }),
    ]);
    listRegistrations.mockResolvedValue(NO_REGISTRATIONS);

    renderPanel();

    await waitFor(() => expect(screen.getByText('Register Rose')).toBeDefined());
    expect(screen.queryByText('Just A Scanner')).toBeNull();
  });

  it('leaves out a register account assigned to a different event', async () => {
    listOperators.mockResolvedValue([operator({ eventIds: ['other-event'] })]);
    listRegistrations.mockResolvedValue(NO_REGISTRATIONS);

    renderPanel();

    await waitFor(() => expect(screen.getByText('No register accounts yet')).toBeDefined());
  });

  it('includes an unpinned account — an empty assignment means every event', async () => {
    listOperators.mockResolvedValue([operator({ eventIds: [] })]);
    listRegistrations.mockResolvedValue(NO_REGISTRATIONS);

    renderPanel();

    await waitFor(() => expect(screen.getByText('Register Rose')).toBeDefined());
    expect(screen.getByText('Works every event of yours, not just this one.')).toBeDefined();
  });

  it('creates an account already pinned to this event and able to issue tags', async () => {
    listOperators.mockResolvedValue([]);
    listRegistrations.mockResolvedValue(NO_REGISTRATIONS);
    createOperator.mockResolvedValue({ operator: operator(), loginCode: '380443', pin: '123456' });

    renderPanel();
    await waitFor(() => expect(screen.getByText('No register accounts yet')).toBeDefined());

    fireEvent.click(screen.getAllByRole('button', { name: /Add register account/ })[0]!);
    fireEvent.change(await screen.findByLabelText('Full name'), { target: { value: 'Desk Dumi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(createOperator).toHaveBeenCalledWith({
      fullName: 'Desk Dumi', eventIds: ['e1'], grants: ['issue_tags'],
    }));
  });

  it('shows each registered tag with who handed it over', async () => {
    listOperators.mockResolvedValue([operator()]);
    listRegistrations.mockResolvedValue({
      registrations: [{
        bandUid: '04AABBCC', walletId: 'w1', at: '2026-08-19T18:00:00.000Z', releasedAt: null,
        balance: 5000, registeredBy: 'Register Rose',
        holder: { name: 'Sipho Nkosi', phone: '+26876001234', ticketCode: 'TKT-1' },
      }],
      hasMore: false, nextCursor: null,
    });

    renderPanel();

    await waitFor(() => expect(screen.getByText('04AABBCC')).toBeDefined());
    expect(screen.getByText('Sipho Nkosi')).toBeDefined();
    expect(screen.getByText('On the wrist')).toBeDefined();
  });

  it('keeps a released tag in the log, marked as released', async () => {
    listOperators.mockResolvedValue([operator()]);
    listRegistrations.mockResolvedValue({
      registrations: [{
        bandUid: '04LOST01', walletId: 'w1', at: '2026-08-19T18:00:00.000Z',
        releasedAt: '2026-08-19T22:00:00.000Z', balance: 0, registeredBy: 'Register Rose',
        holder: { name: 'Lost Lindiwe', phone: null, ticketCode: null },
      }],
      hasMore: false, nextCursor: null,
    });

    renderPanel();

    await waitFor(() => expect(screen.getByText('Released')).toBeDefined());
  });

  it('surfaces a failed load instead of reading as an empty desk', async () => {
    listOperators.mockResolvedValue([]);
    listRegistrations.mockRejectedValue(new Error('boom'));

    renderPanel();

    await waitFor(() => expect(screen.getByText(/Could not load the registrations/)).toBeDefined());
  });
});
