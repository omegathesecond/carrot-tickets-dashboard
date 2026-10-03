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
          <Route path="/events/:id/stalls/:merchantId" element={<StallDetailPage />} />
          <Route path="/events/:id" element={<div>event-home</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** One R25,00 charge with R1,25 taken off it (R23,75 net) — shaped like the real MerchantDetail rows. */
const CHARGE = {
  id: 'txn1', amount: 2500, fee: 125, netAmount: 2375,
  bandUid: '04a1b2c3', status: 'completed', createdAt: '2026-10-03T08:00:00.000Z',
};
const SUMMARY = { totalCharged: 2500, totalNet: 2375, totalFee: 125, count: 1 };

beforeEach(() => {
  vi.clearAllMocks();
  (apiClient.merchantOperators.list as any).mockResolvedValue({ operators: [] });
});
afterEach(cleanup);

describe('StallDetailPage — venue route', () => {
  it('the venue stall route loads the stall through the venue scope and returns to the venue', async () => {
    (apiClient.merchants.transactions as any).mockResolvedValue({
      merchant: { _id: 'm1', name: 'Main Bar', commissionPercent: 0, status: 'active' },
      venue: { id: 'ven1', name: 'Kwa-Linda Lounge' },
      transactions: [], summary: { totalCharged: 0, totalNet: 0, totalFee: 0, count: 0 },
    });

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

  it('a venue stall shows its charges with no commission, fee or net-of-fee figure anywhere', async () => {
    (apiClient.merchants.transactions as any).mockResolvedValue({
      merchant: { _id: 'm1', name: 'Main Bar', commissionPercent: 0, status: 'active' },
      venue: { id: 'ven1', name: 'Kwa-Linda Lounge' },
      transactions: [CHARGE], summary: SUMMARY,
    });

    renderAt('/venue/stalls/m1');

    // The charge row rendered, and its detail line starts at the band — the
    // "Net R23,75 · Fee R1,25 · " prefix is not there.
    expect(await screen.findByText(/^••A1B2C3 · /)).toBeTruthy();
    // Charged card + the charge's own amount.
    expect(screen.getAllByText('R25,00')).toHaveLength(2);
    // ('Charges' is also the list heading, so the card label is picked by tag.)
    expect(screen.getByText('Charges', { selector: 'div' })).toBeTruthy();
    expect(screen.getByText('Charged')).toBeTruthy();

    expect(screen.queryByText('Net owed')).toBeNull();
    expect(screen.queryByText('Commission')).toBeNull();
    expect(screen.queryByText(/commission/i)).toBeNull();
    expect(screen.queryByText(/net/i)).toBeNull();
    expect(screen.queryByText(/\bfee\b/i)).toBeNull();
    // The figures themselves — the net and the fee — are not rendered either.
    expect(screen.queryByText('R23,75')).toBeNull();
    expect(screen.queryByText('R1,25')).toBeNull();
  });
});

describe('StallDetailPage — event route (unchanged)', () => {
  it('an event stall keeps its commission subtitle, Net owed and Commission cards and net/fee charge line', async () => {
    (apiClient.merchants.transactions as any).mockResolvedValue({
      merchant: { _id: 'm1', name: 'Main Bar', commissionPercent: 5, status: 'active' },
      event: { id: 'e1', name: 'Bushfire' },
      transactions: [CHARGE], summary: SUMMARY,
    });

    renderAt('/events/e1/stalls/m1');

    expect(await screen.findByRole('heading', { name: 'Main Bar' })).toBeTruthy();
    expect(apiClient.merchants.transactions).toHaveBeenCalledWith({ kind: 'event', eventId: 'e1' }, 'm1');
    expect(apiClient.merchantOperators.list).toHaveBeenCalledWith({ kind: 'event', eventId: 'e1' }, 'm1');
    expect(screen.getByText('5% commission · Bushfire')).toBeTruthy();

    expect(screen.getByText('Charged').nextElementSibling?.textContent).toBe('R25,00');
    expect(screen.getByText('Net owed').nextElementSibling?.textContent).toBe('R23,75');
    expect(screen.getByText('Commission').nextElementSibling?.textContent).toBe('R1,25');
    expect(screen.getByText('Charges', { selector: 'div' }).nextElementSibling?.textContent).toBe('1');
    expect(screen.getByText(/^Net R23,75 · Fee R1,25 · ••A1B2C3 · /)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Stalls' }));

    expect(await screen.findByText('event-home')).toBeTruthy();
  });
});
