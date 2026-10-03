// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/api', () => ({
  apiClient: {
    merchants: { transactions: vi.fn() },
    merchantOperators: { list: vi.fn() },
  },
}));

import { apiClient } from '@/lib/api';
import { StallDetailPage } from '@/pages/StallDetailPage';

function renderAt(url: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/venue/stalls/:merchantId" element={<StallDetailPage />} />
          <Route path="/venue" element={<div>venue-home</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => { vi.clearAllMocks(); });
afterEach(cleanup);

describe('StallDetailPage — venue route', () => {
  it('the venue stall route loads the stall through the venue scope and returns to the venue', async () => {
    (apiClient.merchants.transactions as any).mockResolvedValue({
      merchant: { _id: 'm1', name: 'Main Bar', commissionPercent: 0, status: 'active' },
      venue: { id: 'ven1', name: 'Kwa-Linda Lounge' },
      transactions: [], summary: { totalCharged: 0, totalNet: 0, totalFee: 0, count: 0 },
    });
    (apiClient.merchantOperators.list as any).mockResolvedValue({ operators: [] });

    renderAt('/venue/stalls/m1');

    expect(await screen.findByRole('heading', { name: 'Main Bar' })).toBeTruthy();
    expect(apiClient.merchants.transactions).toHaveBeenCalledWith({ kind: 'venue' }, 'm1');
    expect(apiClient.merchantOperators.list).toHaveBeenCalledWith({ kind: 'venue' }, 'm1');
    expect(screen.getByText(/Kwa-Linda Lounge/)).toBeTruthy();
    // A venue stall never carries a commission — neither the "% commission"
    // line nor the Commission figure card may appear.
    expect(screen.queryByText(/commission/i)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Stalls' }));

    expect(await screen.findByText('venue-home')).toBeTruthy();
  });
});
