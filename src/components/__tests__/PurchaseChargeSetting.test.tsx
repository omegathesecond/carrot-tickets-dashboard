// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CashlessFeeSetting } from '@/components/cashless/CashlessFeeSetting';
import type { Event } from '@/types';
const update = vi.fn();
const errorToast = vi.fn();
vi.mock('@/lib/api', () => ({ apiClient: { events: { updateEvent: (...args: unknown[]) => update(...args) } } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: (...args: unknown[]) => errorToast(...args) } }));
afterEach(cleanup);
beforeEach(() => { update.mockReset().mockResolvedValue({}); errorToast.mockClear(); });
function setup(purchaseCharge: Event['purchaseCharge'] = null) {
  render(<QueryClientProvider client={new QueryClient()}><CashlessFeeSetting field="purchaseCharge" event={{ _id: 'event', currency: 'SZL', purchaseCharge } as Event} /></QueryClientProvider>);
}
describe('organizer purchase charge settings', () => {
  it('saves a fixed amount as integer cents', async () => {
    setup();
    fireEvent.change(screen.getByLabelText('Purchase charge type'), { target: { value: 'fixed' } });
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
    fireEvent.change(screen.getByLabelText('Purchase charge type'), { target: { value: 'off' } });
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

it('saves adjoining tier ranges in cents and prevents incomplete tiers', async () => {
  setup();
  fireEvent.change(screen.getByLabelText('Purchase charge type'), { target: { value: 'tiered' } });
  fireEvent.change(screen.getByLabelText('Fee (E)'), { target: { value: '1' } });
  fireEvent.click(screen.getByText('Add tier'));
  expect((screen.getByText('Save purchase charge') as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getAllByLabelText('Below (E)')[0]!, { target: { value: '100' } });
  fireEvent.change(screen.getAllByLabelText('Fee (E)')[1]!, { target: { value: '2.50' } });
  fireEvent.click(screen.getByText('Save purchase charge'));
  await waitFor(() => expect(update).toHaveBeenCalledWith('event', { purchaseCharge: { type: 'tiered', tiers: [{ min: 0, max: 10000, fee: 100 }, { min: 10000, max: null, fee: 250 }] } }));
});
it('saves an independent withdrawal fee', async () => {
  render(<QueryClientProvider client={new QueryClient()}><CashlessFeeSetting field="withdrawalFee" event={{ _id: 'event', currency: 'SZL' } as Event} /></QueryClientProvider>);
  fireEvent.change(screen.getByLabelText('Withdrawal fee type'), { target: { value: 'fixed' } });
  fireEvent.change(screen.getByLabelText('Amount (E)'), { target: { value: '5' } });
  fireEvent.click(screen.getByText('Save withdrawal fee'));
  await waitFor(() => expect(update).toHaveBeenCalledWith('event', { withdrawalFee: { type: 'fixed', value: 500 } }));
});

it.each(['purchaseCharge', 'withdrawalFee'] as const)('lets mobile users type limits and decimal fees for %s without losing drafts', async (field) => {
  render(<QueryClientProvider client={new QueryClient()}><CashlessFeeSetting field={field} event={{ _id: 'event', currency: 'SZL' } as Event} /></QueryClientProvider>);
  const label = field === 'purchaseCharge' ? 'Purchase charge' : 'Withdrawal fee';
  fireEvent.change(screen.getByLabelText(`${label} type`), { target: { value: 'tiered' } });
  const limit = screen.getByLabelText('Below (E)') as HTMLInputElement;
  expect(limit.readOnly).toBe(false);
  expect(limit.inputMode).toBe('decimal');
  expect(limit.placeholder).toBe('No limit');
  expect(screen.getByLabelText('From (E)').tagName).toBe('OUTPUT');
  fireEvent.change(limit, { target: { value: '1' } });
  fireEvent.change(limit, { target: { value: '100' } });
  expect(screen.getAllByLabelText('Below (E)')[0]).toBe(limit);
  expect(screen.getAllByLabelText('Below (E)')).toHaveLength(2);
  const fee = screen.getAllByLabelText('Fee (E)')[0] as HTMLInputElement;
  expect(fee.type).toBe('text');
  expect(fee.inputMode).toBe('decimal');
  fireEvent.change(fee, { target: { value: '2,' } });
  expect(fee.value).toBe('2,');
  fireEvent.change(fee, { target: { value: '2,50' } });
  fireEvent.change(screen.getAllByLabelText('Fee (E)')[1]!, { target: { value: '5' } });
  fireEvent.click(screen.getByText(`Save ${label.toLowerCase()}`));
  await waitFor(() => expect(update).toHaveBeenCalledWith('event', { [field]: { type: 'tiered', tiers: [{ min: 0, max: 10000, fee: 250 }, { min: 10000, max: null, fee: 500 }] } }));
});
