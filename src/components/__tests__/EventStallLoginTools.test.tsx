// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EventStallLoginTools } from '@/components/EventStallLoginTools';
const create = vi.fn();
const success = vi.fn();
const info = vi.fn();
const error = vi.fn();
vi.mock('@/lib/api', () => ({ apiClient: { merchantOperators: { createMissingForEvent: (...args: unknown[]) => create(...args) } } }));
vi.mock('sonner', () => ({ toast: { success: (...args: unknown[]) => success(...args), info: (...args: unknown[]) => info(...args), error: (...args: unknown[]) => error(...args) } }));
vi.mock('@/components/StallLoginPicker', () => ({ StallLoginPicker: () => <button>Share one login</button> }));
vi.mock('@/components/StallLoginExports', () => ({ StallLoginExports: () => <button>Download all logins</button>, stallLoginTargets: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
function mount() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(<QueryClientProvider client={client}><EventStallLoginTools eventId="e1" eventName="Phakama" /></QueryClientProvider>);
  return invalidate;
}
it('creates users for this event, prevents pending clicks and refreshes users and sharing', async () => {
  let finish!: (result: { created: number; existing: number; inactive: number; skipped: number }) => void;
  create.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const invalidate = mount();
  fireEvent.click(screen.getByRole('button', { name: 'Auto-create users' }));
  await waitFor(() => expect(create).toHaveBeenCalledExactlyOnceWith('e1'));
  const pending = await screen.findByRole('button', { name: 'Creating users…' });
  expect(pending).toHaveProperty('disabled', true);
  fireEvent.click(pending);
  expect(create).toHaveBeenCalledTimes(1);
  finish({ created: 2, existing: 3, inactive: 0, skipped: 0 });
  await waitFor(() => expect(success).toHaveBeenCalledWith('Created 2 users. 3 stalls already had matching users.'));
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['merchantOperators'] });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['stall-login-people', 'e1'] });
  expect(screen.getByRole('button', { name: 'Auto-create users' })).toHaveProperty('disabled', false);
});
it('surfaces failures and lets the user retry without claiming success', async () => {
  create.mockRejectedValue(new Error('Unable to create stall users'));
  const invalidate = mount();
  fireEvent.click(screen.getByRole('button', { name: 'Auto-create users' }));
  await waitFor(() => expect(error).toHaveBeenCalledWith('Unable to create stall users'));
  expect(success).not.toHaveBeenCalled();
  expect(invalidate).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Auto-create users' })).toHaveProperty('disabled', false);
});
it('explains when no active stalls exist', async () => {
  create.mockResolvedValue({ created: 0, existing: 0, inactive: 0, skipped: 2 });
  mount(); fireEvent.click(screen.getByRole('button', { name: 'Auto-create users' }));
  await waitFor(() => expect(info).toHaveBeenCalledWith('Add active stalls first, then auto-create their users.'));
  expect(success).not.toHaveBeenCalled();
});
it('reports existing deactivated accounts without offering PIN exports to non-admins', async () => {
  create.mockResolvedValue({ created: 0, existing: 1, inactive: 1, skipped: 0 });
  mount(); fireEvent.click(screen.getByRole('button', { name: 'Auto-create users' }));
  await waitFor(() => expect(info).toHaveBeenCalledWith('1 matching user is deactivated. Reactivate them from the stall if needed.'));
  expect(screen.queryByRole('button', { name: 'Share one login' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Download all logins' })).toBeNull();
});
