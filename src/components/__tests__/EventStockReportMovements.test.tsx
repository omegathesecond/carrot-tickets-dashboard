// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EventStockReport } from '@/components/EventStockReport';
import type { StockMovementRow } from '@/lib/api';

// MovementsSection isn't exported on its own — only EventStockReport is — so
// this renders the whole report and mocks all four of its report queries.
// The board/dashboard/reconciliation queries are given minimal empty-shaped
// data so those sections settle into their "empty" state and don't interfere
// with the movements assertions below.
const getEventStockBoard = vi.fn();
const getEventStockDashboard = vi.fn();
const getEventStockReconciliation = vi.fn();
const getEventStockMovements = vi.fn();

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    apiClient: {
      events: {
        getEventStockBoard: (...a: unknown[]) => getEventStockBoard(...a),
        getEventStockDashboard: (...a: unknown[]) => getEventStockDashboard(...a),
        getEventStockReconciliation: (...a: unknown[]) => getEventStockReconciliation(...a),
        getEventStockMovements: (...a: unknown[]) => getEventStockMovements(...a),
      },
    },
  };
});

const renderMovements = async (movements: StockMovementRow[]) => {
  getEventStockBoard.mockResolvedValue({ event: { id: 'e1', name: 'Event' }, perBar: [], byProduct: [] });
  getEventStockDashboard.mockResolvedValue({
    event: { id: 'e1', name: 'Event' },
    revenueByProduct: [],
    bestSellers: [],
    salesByBar: [],
    salesByEmployee: [],
    itemisedSplit: { itemised: { gross: 0, count: 0 }, unitemised: { gross: 0, count: 0 } },
    peakTimes: [],
    variances: [],
    totalShrinkageUnits: 0,
    predictedStockOut: [],
    noRecentSales: 0,
  });
  getEventStockReconciliation.mockResolvedValue({
    event: { id: 'e1', name: 'Event' },
    perBar: [],
    byProduct: [],
    total: {
      opening: 0, added: 0, transferIn: 0, transferOut: 0, sold: 0,
      countAdjust: 0, spoilage: 0, manual: 0, expectedClosing: 0,
      physicalCount: null, variance: null,
    },
  });
  getEventStockMovements.mockResolvedValue({ movements, nextCursor: null, hasMore: false });

  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <EventStockReport eventId="e1" />
    </QueryClientProvider>,
  );
};

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('EventStockReport movements — Who column', () => {
  it('names the stall operator who wrote a movement', async () => {
    // byName is resolved server-side; the table shows it verbatim.
    await renderMovements([
      { id: 'm1', at: '2026-09-05T10:00:00.000Z', merchantId: 'b1', merchantName: 'Sandwich Stall',
        productId: 'p1', productName: 'Castle Lite', delta: 24, reason: 'receive', balanceAfter: 24,
        refType: null, refId: null, byType: 'Merchant', by: 'op1', byName: 'Nomsa Shongwe', note: null },
    ]);
    expect(await screen.findByText('Nomsa Shongwe')).toBeTruthy();
  });

  it('shows a dash rather than a raw id for organizer-written rows', async () => {
    // byName is null for byType 'Organizer' — their `by` is a vendor id, not a
    // person, and printing a hex string in a Who column is worse than a dash.
    // (Asserting the dash itself, not just the hex's absence, matters: with no
    // Who column at all the hex is *also* absent, which would make this test
    // pass whether or not the column exists.)
    await renderMovements([
      { id: 'm2', at: '2026-09-05T10:00:00.000Z', merchantId: 'b1', merchantName: 'Sandwich Stall',
        productId: 'p1', productName: 'Castle Lite', delta: 100, reason: 'receive', balanceAfter: 124,
        refType: null, refId: null, byType: 'Organizer', by: '64b000000000000000000a01', byName: null, note: null },
    ]);
    expect(await screen.findByText('Castle Lite')).toBeTruthy();
    expect(await screen.findByText('—')).toBeTruthy();
    expect(screen.queryByText('64b000000000000000000a01')).toBeNull();
  });

  it('renders a spoilage row with its own badge, alongside who wrote it', async () => {
    // The first movements ever written with reason 'spoilage' arrive with this
    // feature; REASON_CLASS already styles it, so this only guards the wiring.
    // Asserting byName too (not just the reason badge) matters: the reason
    // badge is pre-existing behaviour that renders identically with or
    // without a Who column, so on its own it would pass either way.
    await renderMovements([
      { id: 'm3', at: '2026-09-05T10:00:00.000Z', merchantId: 'b1', merchantName: 'Sandwich Stall',
        productId: 'p1', productName: 'Castle Lite', delta: -6, reason: 'spoilage', balanceAfter: 18,
        refType: null, refId: null, byType: 'Merchant', by: 'op1', byName: 'Nomsa Shongwe', note: 'crate dropped' },
    ]);
    expect(await screen.findByText('spoilage')).toBeTruthy();
    expect(screen.getByText('Nomsa Shongwe')).toBeTruthy();
  });
});
