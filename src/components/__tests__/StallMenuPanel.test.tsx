// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StallMenuPanel } from '@/components/StallMenuPanel';
const menu = vi.fn();
vi.mock('@/lib/api', () => ({ PRODUCT_CATEGORIES: [{ value: 'food', label: 'Food' }], apiClient: { merchants: { menu: (...args: unknown[]) => menu(...args) } } }));
afterEach(cleanup);
beforeEach(() => { menu.mockReset(); });
const response = { merchantId: 'm1', event: { id: 'e1', name: 'Festival', currency: 'ZAR' }, products: [{ productId: 'p1', name: 'The Meat Hub - Beef & pap', price: 10000, category: 'food', status: 'untracked', onHand: 0, unitLabel: 'item', bundlePrice: null }] };
function mount() { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><StallMenuPanel eventId="e1" merchantId="m1" stallName="THE MEAT HUB" /></QueryClientProvider>); }
it('shows the assigned menu with clean names, exact prices and quantity-free availability', async () => {
 menu.mockResolvedValue(response); mount();
 expect(await screen.findByText('Beef & pap')).toBeTruthy();
 expect(screen.getByText('R100.00')).toBeTruthy(); expect(screen.getByText('Not counted')).toBeTruthy();
 expect(screen.queryByText('Sold out')).toBeNull(); expect(menu).toHaveBeenCalledWith('m1');
 fireEvent.change(screen.getByLabelText('Search stall menu'), { target: { value: 'chicken' } });
 expect(screen.getByText('No menu items match your search.')).toBeTruthy();
});
it('renders a real empty menu distinctly from a failed request', async () => {
 menu.mockResolvedValue({ ...response, products: [] }); mount();
 expect(await screen.findByText('No menu items have been assigned to this stall yet.')).toBeTruthy();
});
it('shows a menu failure and permits retry', async () => {
 menu.mockRejectedValueOnce(new Error('Catalogue unavailable')).mockResolvedValue(response); mount();
 expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('Catalogue unavailable'));
 expect(screen.queryByText('No menu items have been assigned to this stall yet.')).toBeNull();
 fireEvent.click(screen.getByRole('button', { name: 'Retry menu' }));
 expect(await screen.findByText('Beef & pap')).toBeTruthy();
});
it('refuses a menu for a different event', async () => {
 menu.mockResolvedValue({ ...response, event: { ...response.event, id: 'other' } }); mount();
 expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('does not belong'));
 expect(screen.queryByText('Beef & pap')).toBeNull();
});
