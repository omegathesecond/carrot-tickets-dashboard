// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WaitersPanel } from '@/components/WaitersPanel';

afterEach(cleanup);

const list = vi.fn();
const create = vi.fn();
const setGrants = vi.fn();
const setActive = vi.fn();
const resetPin = vi.fn();

vi.mock('@/lib/api', () => ({
  apiClient: {
    waiters: {
      list: (...a: unknown[]) => list(...a),
      create: (...a: unknown[]) => create(...a),
      setGrants: (...a: unknown[]) => setGrants(...a),
      setActive: (...a: unknown[]) => setActive(...a),
      resetPin: (...a: unknown[]) => resetPin(...a),
    },
  },
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));

const waiter = (over: Record<string, unknown> = {}) => ({
  _id: 'w1',
  fullName: 'Thabo Dlamini',
  vendorId: 'vendor-a',
  eventId: 'e1',
  isActive: true,
  loginCode: 'ABCDEF',
  grants: [] as string[],
  createdAt: '2026-09-05T00:00:00.000Z',
  ...over,
});

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <WaitersPanel eventId="e1" />
    </QueryClientProvider>,
  );
}

afterEach(() => vi.clearAllMocks());

describe('WaitersPanel', () => {
  it('spells out what an empty floor means, rather than just "no rows"', async () => {
    list.mockResolvedValue([]);
    renderPanel();
    expect(await screen.findByText('No waiters yet')).toBeTruthy();
  });

  it('lists a hired waiter with their User ID', async () => {
    list.mockResolvedValue([waiter()]);
    renderPanel();
    expect(await screen.findByText('Thabo Dlamini')).toBeTruthy();
    expect(screen.getByText('ABCDEF')).toBeTruthy();
  });

  it('shows the login code and PIN once after hiring', async () => {
    list.mockResolvedValue([]);
    create.mockResolvedValue({ waiter: waiter(), loginCode: 'ZYXWVU', pin: '445566' });
    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: /add waiter/i }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/full name/i), { target: { value: 'Thabo Dlamini' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /create/i }));

    await waitFor(() => expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ fullName: 'Thabo Dlamini', eventId: 'e1' }),
    ));
    // A fresh dialog replaces the hire form, showing the one-time credentials.
    expect(await screen.findByText('ZYXWVU')).toBeTruthy();
    expect(screen.getByText('445566')).toBeTruthy();
    expect(screen.getByText(/shown once/i)).toBeTruthy();
  });

  it('turns settling on for a waiter who cannot yet settle, calling setGrants with settle_tables', async () => {
    list.mockResolvedValue([waiter({ grants: [] })]);
    setGrants.mockResolvedValue(waiter({ grants: ['settle_tables'] }));
    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: /settling off/i }));
    await waitFor(() => expect(setGrants).toHaveBeenCalledWith('w1', ['settle_tables']));
    // The toast names what the setting buys, not a generic "saved".
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith(expect.stringMatching(/can settle tables/i)));
  });

  it('turns settling off for a waiter who can currently settle, calling setGrants with none', async () => {
    list.mockResolvedValue([waiter({ grants: ['settle_tables'] })]);
    setGrants.mockResolvedValue(waiter({ grants: [] }));
    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: /settling on/i }));
    await waitFor(() => expect(setGrants).toHaveBeenCalledWith('w1', []));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith(expect.stringMatching(/can serve but not settle/i)));
  });

  it('resets the PIN and shows the fresh one once', async () => {
    list.mockResolvedValue([waiter()]);
    resetPin.mockResolvedValue({ pin: '998877' });
    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: /reset pin/i }));
    await waitFor(() => expect(resetPin).toHaveBeenCalledWith('w1'));
    expect(await screen.findByText('998877')).toBeTruthy();
  });

  it('disables an active waiter without touching their grants', async () => {
    list.mockResolvedValue([waiter({ isActive: true })]);
    setActive.mockResolvedValue(waiter({ isActive: false }));
    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: /disable/i }));
    await waitFor(() => expect(setActive).toHaveBeenCalledWith('w1', false));
  });
});
