// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PurchaseChargeSetting } from '@/components/cashless/PurchaseChargeSetting';
import type { Event } from '@/types';
const update = vi.fn();
const errorToast = vi.fn();
vi.mock('@/lib/api', () => ({ apiClient: { events: { updateEvent: (...args: unknown[]) => update(...args) } } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: (...args: unknown[]) => errorToast(...args) } }));
afterEach(cleanup);
beforeEach(() => { update.mockReset().mockResolvedValue({}); errorToast.mockClear(); });
function setup(purchaseCharge: Event['purchaseCharge'] = null) {
  render(<QueryClientProvider client={new QueryClient()}><PurchaseChargeSetting event={{ _id: 'event', currency: 'SZL', purchaseCharge } as Event} /></QueryClientProvider>);
}
describe('organizer purchase charge settings', () => {
  it('saves a fixed amount as integer cents', async () => {
    setup();
    fireEvent.change(screen.getByLabelText('Charge type'), { target: { value: 'fixed' } });
    fireEvent.change(screen.getByLabelText('Amount (E)'), { target: { value: '2.50' } });
    fireEvent.click(screen.getByText('Save purchase charge'));
    await waitFor(() => expect(update).toHaveBeenCalledWith('event', { purchaseCharge: { type: 'fixed', value: 250 } }));
  });
  it('loads the saved percentage, lets the organizer change it and disables it', async () => {
    setup({ type: 'percentage', value: 5 });
    expect((screen.getByLabelText('Percentage (%)') as HTMLInputElement).value).toBe('5');
    fireEvent.change(screen.getByLabelText('Percentage (%)'), { target: { value: '7.25' } });
    fireEvent.click(screen.getByText('Save purchase charge'));
    await waitFor(() => expect(update).toHaveBeenCalledWith('event', { purchaseCharge: { type: 'percentage', value: 7.25 } }));
    await waitFor(() => expect((screen.getByText('Save purchase charge') as HTMLButtonElement).disabled).toBe(false));
    fireEvent.change(screen.getByLabelText('Charge type'), { target: { value: 'off' } });
    fireEvent.click(screen.getByText('Save purchase charge'));
    await waitFor(() => expect(update).toHaveBeenLastCalledWith('event', { purchaseCharge: null }));
  });
  it('rejects invalid percentages and surfaces failed saves', async () => {
    setup({ type: 'percentage', value: 5 });
    fireEvent.change(screen.getByLabelText('Percentage (%)'), { target: { value: '101' } });
    expect((screen.getByText('Save purchase charge') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Percentage (%)'), { target: { value: '5' } });
    update.mockRejectedValue(new Error('Could not save setting'));
    fireEvent.click(screen.getByText('Save purchase charge'));
    await waitFor(() => expect(errorToast).toHaveBeenCalledWith('Could not save setting'));
  });
});
