// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EventResourceActions } from '../EventResourceActions';
const error = vi.fn();
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: (...args: unknown[]) => error(...args) } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

function setup(canDelete = true, stall = false) {
  const save = vi.fn().mockResolvedValue({});
  const remove = vi.fn().mockResolvedValue({ deleted: true });
  const reveal = vi.fn().mockResolvedValue({ loginCode: 'ABC123', pin: '012345' });
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><EventResourceActions kind={stall ? 'stall' : 'cashier'}
    initial={stall ? { name: 'Main Bar', commissionPercent: '5' } : { name: 'Thabo', phoneNumber: '+26870000001' }}
    canDelete={canDelete} queryKey={['cashiers', 'e1']} onSave={save} onDelete={remove} onReveal={stall ? undefined : reveal} />
  </QueryClientProvider>);
  return { save, remove, reveal };
}

describe('Event resource controls', () => {
  it('edits pre-filled staff details and allows clearing the phone number', async () => {
    const { save } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const dialog = screen.getByRole('dialog');
    expect((within(dialog).getByLabelText('Full name') as HTMLInputElement).value).toBe('Thabo');
    fireEvent.change(within(dialog).getByLabelText('Full name'), { target: { value: ' New name ' } });
    fireEvent.change(within(dialog).getByLabelText('Phone number (optional)'), { target: { value: '' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ name: 'New name', phoneNumber: '' })));
  });
  it('requires confirmation before deleting', async () => {
    const { remove } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(remove).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(remove).toHaveBeenCalledOnce());
  });
  it('reveals the existing PIN without resetting it and clears it on close', async () => {
    const { reveal } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Show PIN' }));
    expect(await screen.findByText('012345')).toBeTruthy();
    expect(reveal).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByText('012345')).toBeNull());
  });
  it('surfaces a reveal failure', async () => {
    const { reveal } = setup();
    reveal.mockRejectedValue(new Error('Reset it once'));
    fireEvent.click(screen.getByRole('button', { name: 'Show PIN' }));
    await waitFor(() => expect(error).toHaveBeenCalledWith('Reset it once'));
    expect(screen.queryByText('012345')).toBeNull();
  });
  it('hides delete and reveal from non-admins', () => {
    setup(false);
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Show PIN' })).toBeNull();
  });
  it('pre-fills stall commission and refuses an invalid rate', () => {
    const { save } = setup(true, true);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect((screen.getByLabelText('Commission %') as HTMLInputElement).value).toBe('5');
    fireEvent.change(screen.getByLabelText('Commission %'), { target: { value: '101' } });
    expect((screen.getByRole('button', { name: 'Save changes' }) as HTMLButtonElement).disabled).toBe(true);
    expect(save).not.toHaveBeenCalled();
  });
});
