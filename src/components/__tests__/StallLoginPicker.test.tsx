// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StallLoginPicker } from '@/components/StallLoginPicker';
const reveal = vi.fn();
vi.mock('@/lib/api', () => ({ apiClient: { merchantOperators: { revealPin: (...a: unknown[]) => reveal(...a) } } }));
vi.mock('@/components/OperatorCredentialsDialog', () => ({ OperatorCredentialsDialog: (props: { loginCode: string; cardIdentity: { operatorName: string; stallName: string } }) => <div role="dialog"><p>{props.cardIdentity.operatorName}</p><p>{props.cardIdentity.stallName}</p><p>{props.loginCode}</p></div> }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const people = [{ id: 'op1', operatorName: 'Nomsa Shongwe', stallName: 'The Meat Hub', loginCode: 'ABC123' }, { id: 'op2', operatorName: 'Sipho Mabuza', stallName: 'Surf N Fries', loginCode: 'DEF456' }];
function mount(load = vi.fn().mockResolvedValue(people)) { render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><StallLoginPicker eventId="e1" eventName="Phakama" loadTargets={load} /></QueryClientProvider>); return load; }
it('finds a person from the main page and reads only that person’s PIN on selection', async () => {
 const load = mount(); expect(load).not.toHaveBeenCalled(); expect(reveal).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button', { name: 'Share one login' }));
 expect(await screen.findByText('Nomsa Shongwe')).toBeTruthy(); expect(reveal).not.toHaveBeenCalled();
 fireEvent.change(screen.getByLabelText('Find a stall operator'), { target: { value: 'Surf N Fries' } });
 expect(screen.queryByText('Nomsa Shongwe')).toBeNull();
 reveal.mockResolvedValue({ loginCode: 'DEF456', pin: '654321' });
 fireEvent.click(screen.getByRole('button', { name: 'Open login card for Sipho Mabuza at Surf N Fries' }));
 await waitFor(() => expect(reveal).toHaveBeenCalledExactlyOnceWith('op2'));
 expect(await screen.findByText('DEF456')).toBeTruthy(); expect(screen.queryByText('ABC123')).toBeNull();
});
it('shows an error rather than an empty people list when the request fails', async () => {
 mount(vi.fn().mockRejectedValue(new Error('Staff unavailable')));
 fireEvent.click(screen.getByRole('button', { name: 'Share one login' }));
 expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('Staff unavailable'));
 expect(screen.queryByText('No active till logins. Add people to the stalls first.')).toBeNull();
});
