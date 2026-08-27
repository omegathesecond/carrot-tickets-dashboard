// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { EventRegisterPanel } from '@/components/cashless/EventRegisterPanel';

afterEach(cleanup);

const listOperators = vi.fn();
const createOperator = vi.fn();
vi.mock('@/lib/api', () => ({
  apiClient: {
    gateOperators: {
      list: () => listOperators(),
      create: (...a: unknown[]) => createOperator(...a),
      resetPin: vi.fn(),
      setActive: vi.fn(),
    },
  },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

const operator = (over: Record<string, unknown> = {}) => ({
  _id: 'op1', fullName: 'Register Rose', scope: 'organizer', eventIds: ['e1'],
  isActive: true, loginCode: '380443', grants: ['issue_tags'], createdAt: '2026-08-19T10:00:00.000Z',
  ...over,
});

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

    renderPanel();

    await waitFor(() => expect(screen.getByText('Register Rose')).toBeDefined());
    expect(screen.queryByText('Just A Scanner')).toBeNull();
  });

  it('leaves out a register account assigned to a different event', async () => {
    listOperators.mockResolvedValue([operator({ eventIds: ['other-event'] })]);

    renderPanel();

    await waitFor(() => expect(screen.getByText('No register accounts yet')).toBeDefined());
  });

  it('includes an unpinned account — an empty assignment means every event', async () => {
    listOperators.mockResolvedValue([operator({ eventIds: [] })]);

    renderPanel();

    await waitFor(() => expect(screen.getByText('Register Rose')).toBeDefined());
    expect(screen.getByText('Works every event of yours, not just this one.')).toBeDefined();
  });

  it('creates an account already pinned to this event and able to issue tags', async () => {
    listOperators.mockResolvedValue([]);
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
});
