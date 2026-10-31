// @vitest-environment jsdom
import { afterEach, beforeEach, it, expect, vi } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EventTagsPanel } from '@/components/cashless/EventTagsPanel';
import { fmtR } from '@/lib/money';

const summary = vi.fn();
const list = vi.fn();
vi.mock('@/lib/api', () => ({ apiClient: { tags: {
  summary: (...a: unknown[]) => summary(...a), list: (...a: unknown[]) => list(...a), detail: vi.fn(),
} } }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
beforeEach(() => summary.mockResolvedValue({ tagsInUse: 10000, activeTags: 10000, unboundTags: 0,
  balanceOutstanding: 67500, cashFundedOutstanding: 20000, averageBalance: 7 }));
const row = (id: string, balance: number) => ({ walletId: id, bandUid: id, status: 'active' as const,
  balance, cashFundedBalance: balance, holder: { name: 'Holder '+id, phone: null, ticketCode: null } });
const page = (tags: ReturnType<typeof row>[], nextCursor: string | null = null) => ({ tags, hasMore: !!nextCursor, nextCursor });
function mount() {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <EventTagsPanel eventId="e1" />
  </QueryClientProvider>);
}
const money = (cents: number) => (text: string) => text.replace(/\s/g, '') === fmtR(cents).replace(/\s/g, '');

it('shows event totals and requests funded tags directly from the server', async () => {
  list.mockResolvedValue(page([row('FUNDED', 2500)]));
  mount();
  expect(await screen.findByText('FUNDED')).toBeDefined();
  expect(screen.getByText('Holder FUNDED')).toBeDefined();
  expect(screen.getByText(money(67500))).toBeDefined();
  expect(list).toHaveBeenCalledExactlyOnceWith('e1', { fundedOnly: true, limit: 200 });
});

it('loads every funded page on demand without scanning empty tags or applying a scan cap', async () => {
  list.mockImplementation(async (_event: string, params: { cursor?: string }) => params.cursor
    ? page([row('BIGGER', 12000)]) : page([row('SMALLER', 6000)], 'c1'));
  mount();
  expect(await screen.findByText('SMALLER')).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'Load more tags' }));
  expect(await screen.findByText('BIGGER')).toBeDefined();
  expect(list).toHaveBeenLastCalledWith('e1', { fundedOnly: true, limit: 200, cursor: 'c1' });
  expect(screen.getAllByText(/^(BIGGER|SMALLER)$/).map(n => n.textContent)).toEqual(['BIGGER', 'SMALLER']);
  expect(screen.queryByRole('button', { name: 'Load more tags' })).toBeNull();
});

it('switches off the server filter to include empty tags and resets pagination', async () => {
  list.mockImplementation(async (_event: string, params: { fundedOnly: boolean }) => page(params.fundedOnly ? [row('FUNDED', 100)] : [row('EMPTY', 0), row('FUNDED', 100)]));
  mount();
  expect(await screen.findByText('FUNDED')).toBeDefined();
  fireEvent.click(screen.getByRole('switch'));
  expect(await screen.findByText('EMPTY')).toBeDefined();
  expect(list).toHaveBeenLastCalledWith('e1', { fundedOnly: false, limit: 200 });
});

it('searches funded tags on the server and explains a search without funded matches', async () => {
  list.mockResolvedValue(page([]));
  mount();
  fireEvent.change(screen.getByPlaceholderText(/search tag uid/i), { target: { value: ' EMPTYTAG ' } });
  expect(await screen.findByText(/switch off funded only/i)).toBeDefined();
  expect(list).toHaveBeenLastCalledWith('e1', { fundedOnly: true, limit: 200, q: 'EMPTYTAG' });
});

it('uses distinct empty messages for funded-only and all tags', async () => {
  list.mockResolvedValue(page([])); mount();
  expect(await screen.findByText('No tags are holding a balance.')).toBeDefined();
  fireEvent.click(screen.getByRole('switch'));
  expect(await screen.findByText('No tags issued yet.')).toBeDefined();
});

it('shows a failed list request as an error and retries without claiming an empty balance', async () => {
  list.mockRejectedValueOnce(new Error('Tags unavailable')).mockResolvedValue(page([row('RECOVERED', 500)]));
  mount();
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('Tags unavailable'));
  expect(screen.queryByText('No tags are holding a balance.')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Retry tags' }));
  expect(await screen.findByText('RECOVERED')).toBeDefined();
});

it('surfaces failed totals without replacing them with zero', async () => {
  summary.mockRejectedValue(new Error('Totals unavailable'));
  list.mockResolvedValue(page([])); mount();
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('Totals unavailable'));
  expect(screen.queryByText(money(0))).toBeNull();
});

it('refreshes the funded list after a new top-up without reloading the page', async () => {
  list.mockResolvedValueOnce(page([])).mockResolvedValue(page([row('NEWLYFUNDED', 3000)]));
  mount();
  expect(await screen.findByText('No tags are holding a balance.')).toBeDefined();
  await waitFor(() => expect(screen.getByText('NEWLYFUNDED')).toBeDefined(), { timeout: 6500 });
}, 10000);
