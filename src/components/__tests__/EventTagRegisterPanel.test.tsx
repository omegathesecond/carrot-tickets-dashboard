// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EventTagRegisterPanel } from '@/components/cashless/EventTagRegisterPanel';

afterEach(cleanup);

const registry = vi.fn();
const registerMany = vi.fn();
const retire = vi.fn();
vi.mock('@/lib/api', () => ({
  apiClient: {
    tags: {
      registry: (...a: unknown[]) => registry(...a),
      registerMany: (...a: unknown[]) => registerMany(...a),
      retire: (...a: unknown[]) => retire(...a),
    },
  },
}));

const toastSuccess = vi.fn();
const toastWarning = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    warning: (...a: unknown[]) => toastWarning(...a),
    error: vi.fn(),
  },
}));

const EMPTY = { tags: [], total: 0, counts: { active: 0, retired: 0, total: 0 } };

const tag = (over: Record<string, unknown> = {}) => ({
  bandUid: '04a22b1c', status: 'active', registeredAt: '2026-08-20T10:00:00.000Z',
  registeredBy: 'Register Rose', retiredAt: null, retiredReason: null, ...over,
});

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <EventTagRegisterPanel eventId="e1" />
    </QueryClientProvider>,
  );
}

describe('EventTagRegisterPanel', () => {
  it('spells out what an empty register means, rather than just "no rows"', async () => {
    registry.mockResolvedValue(EMPTY);
    renderPanel();

    await waitFor(() => expect(screen.getByText('No tags registered yet')).toBeTruthy());
    expect(screen.getByText(/nobody can be given one at this event/i)).toBeTruthy();
  });

  it('shows each tag with who registered it and whether it still works', async () => {
    registry.mockResolvedValue({
      tags: [tag(), tag({ bandUid: '04a22b1d', status: 'retired', retiredReason: 'snapped' })],
      total: 2,
      counts: { active: 1, retired: 1, total: 2 },
    });
    renderPanel();

    await waitFor(() => expect(screen.getByText('04a22b1c')).toBeTruthy());
    expect(screen.getByText('In circulation')).toBeTruthy();
    expect(screen.getByText('Retired — snapped')).toBeTruthy();
    expect(screen.getAllByText('Register Rose')).toHaveLength(2);
  });

  it('registers a pasted list, splitting on newlines and commas alike', async () => {
    registry.mockResolvedValue(EMPTY);
    registerMany.mockResolvedValue({ registered: ['04a22b1c', '04a22b1d'], alreadyRegistered: [], reactivated: [], rejected: [] });
    renderPanel();

    await waitFor(() => expect(screen.getByText('No tags registered yet')).toBeTruthy());
    fireEvent.click(screen.getAllByRole('button', { name: /register tags/i })[0]!);

    const box = await screen.findByLabelText(/tag ids/i);
    fireEvent.change(box, { target: { value: '04a22b1c\n04a22b1d' } });
    fireEvent.click(screen.getByRole('button', { name: 'Register' }));

    await waitFor(() => expect(registerMany).toHaveBeenCalledWith('e1', ['04a22b1c', '04a22b1d']));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('2 tags registered'));
  });

  it('says which lines the server would not take — a rejected uid never vanishes', async () => {
    registry.mockResolvedValue(EMPTY);
    registerMany.mockResolvedValue({
      registered: ['04a22b1c'], alreadyRegistered: ['04a22b1d'], reactivated: [],
      rejected: [{ bandUid: 'nope', reason: 'invalid band uid: must be hex' }],
    });
    renderPanel();

    await waitFor(() => expect(screen.getByText('No tags registered yet')).toBeTruthy());
    fireEvent.click(screen.getAllByRole('button', { name: /register tags/i })[0]!);
    fireEvent.change(await screen.findByLabelText(/tag ids/i), { target: { value: '04a22b1c, 04a22b1d, nope' } });
    fireEvent.click(screen.getByRole('button', { name: 'Register' }));

    await waitFor(() => expect(toastWarning).toHaveBeenCalled());
    const [summary, opts] = toastWarning.mock.calls[0] as [string, { description: string }];
    expect(summary).toContain('1 rejected');
    expect(summary).toContain('1 already in the register');
    expect(opts.description).toContain('nope: invalid band uid: must be hex');
  });

  it('retires a tag so it stops working at this event', async () => {
    registry.mockResolvedValue({ tags: [tag()], total: 1, counts: { active: 1, retired: 0, total: 1 } });
    retire.mockResolvedValue({ bandUid: '04a22b1c', status: 'retired', counts: { active: 0, retired: 1, total: 1 } });
    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: /retire/i }));
    await waitFor(() => expect(retire).toHaveBeenCalledWith('e1', '04a22b1c', expect.any(String)));
  });

  it('offers no Retire on a tag that is already out of circulation', async () => {
    registry.mockResolvedValue({
      tags: [tag({ status: 'retired' })], total: 1, counts: { active: 0, retired: 1, total: 1 },
    });
    renderPanel();

    await waitFor(() => expect(screen.getByText('04a22b1c')).toBeTruthy());
    expect(screen.queryByRole('button', { name: /retire/i })).toBeNull();
  });
});
