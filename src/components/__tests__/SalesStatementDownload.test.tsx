// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SalesStatementDownload } from '../SalesStatementDownload';

const mocks = vi.hoisted(() => ({
  download: vi.fn(), error: vi.fn(), user: { isSuperAdmin: false, permissions: ['tickets:export_reports'] },
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/lib/api', () => ({ apiClient: { downloadStatement: mocks.download } }));
vi.mock('sonner', () => ({ toast: { error: mocks.error } }));
beforeEach(() => { mocks.user.permissions = ['tickets:export_reports']; mocks.download.mockReset().mockResolvedValue(undefined); mocks.error.mockReset(); });
afterEach(cleanup);
function show(kind: 'event' | 'merchant' = 'event') {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
    <SalesStatementDownload kind={kind} id="test-id" name="Market Stall" />
  </QueryClientProvider>);
}

it.each(['csv', 'pdf'] as const)('downloads the full event statement as %s', async format => {
  show();
  fireEvent.click(screen.getByRole('button', { name: `Sales statement (${format.toUpperCase()})` }));
  await waitFor(() => expect(mocks.download).toHaveBeenCalledWith(`/tickets/events/test-id/sales-statement?format=${format}`, `Market_Stall_sales_statement.${format}`));
});

it('downloads the vendor statement and surfaces download failures', async () => {
  mocks.download.mockRejectedValue(new Error('Statement service unavailable'));
  show('merchant');
  fireEvent.click(screen.getByRole('button', { name: 'Sales statement (PDF)' }));
  await waitFor(() => expect(mocks.error).toHaveBeenCalledWith('Statement service unavailable'));
  expect(mocks.download).toHaveBeenCalledWith('/tickets/merchants/test-id/sales-statement?format=pdf', 'Market_Stall_sales_statement.pdf');
});

it('hides statement downloads when export permission is absent', () => {
  mocks.user.permissions = [];
  show();
  expect(screen.queryByRole('button')).toBeNull();
});
