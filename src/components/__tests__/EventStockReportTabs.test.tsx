// @vitest-environment jsdom
//
// "in dashboard stock, remove live stock, move stock and reconciliation into
// tabs" — 2026-09-06
//
// The Stock report was four cards stacked vertically, each with its own query
// and its own loading state, so the reconciliation you came for sat three
// scrolls below charts you did not. And its top card, "Live stock", was the
// third place on this page showing the same numbers: the Stock levels tab
// lists Product / Sold / In stock / Sales / Status per stall, and the
// Catalogue now carries On hand too. All three read the same stock board.
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EventStockReport } from '@/components/EventStockReport';

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

function renderReport() {
  getEventStockBoard.mockResolvedValue({
    event: { id: 'e1', name: 'Event' },
    perBar: [],
    byProduct: [{
      productId: 'p1', productName: 'Castle Lite', category: 'beer',
      totalOnHand: 94, unitsSold: 30, revenue: 500000, status: 'in_stock',
    }],
  });
  getEventStockDashboard.mockResolvedValue({
    event: { id: 'e1', name: 'Event' },
    revenueByProduct: [], bestSellers: [], salesByBar: [], salesByEmployee: [],
    itemisedSplit: { itemised: { gross: 100, count: 1 }, unitemised: { gross: 0, count: 0 } },
    peakTimes: [], variances: [], totalShrinkageUnits: 0,
    predictedStockOut: [], noRecentSales: 0,
  });
  getEventStockReconciliation.mockResolvedValue({
    event: { id: 'e1', name: 'Event' },
    perBar: [],
    byProduct: [{
      productId: 'p1', productName: 'Reconciled Product', opening: 10, added: 5,
      transferIn: 0, transferOut: 0, sold: 3, countAdjust: 0, spoilage: 0,
      manual: 0, expectedClosing: 12, physicalCount: 11, variance: -1,
    }],
    total: {
      opening: 10, added: 5, transferIn: 0, transferOut: 0, sold: 3,
      countAdjust: 0, spoilage: 0, manual: 0, expectedClosing: 12,
      physicalCount: 11, variance: -1,
    },
  });
  getEventStockMovements.mockResolvedValue({
    movements: [{
      id: 'm1', at: '2026-09-05T10:00:00.000Z', merchantId: 'b1',
      merchantName: 'Sandwich Stall', productId: 'p1', productName: 'Moved Product',
      delta: 24, reason: 'receive', balanceAfter: 24, refType: null, refId: null,
      byType: 'Merchant', by: 'op1', byName: 'Nomsa Shongwe', note: null,
    }],
    nextCursor: null,
    hasMore: false,
  });

  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <EventStockReport eventId="e1" />
    </QueryClientProvider>,
  );
}

const tab = (name: string) => screen.getByRole('tab', { name });

/**
 * Radix's TabsTrigger selects on POINTER-DOWN, not click, so fireEvent.click
 * alone leaves the panel unchanged and every assertion after it fails against
 * a tab that never opened.
 */
const openTab = (name: string) => {
  const el = tab(name);
  fireEvent.pointerDown(el, { button: 0, ctrlKey: false, pointerType: 'mouse' });
  fireEvent.mouseDown(el, { button: 0 });
  fireEvent.click(el);
};

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('the Stock report is tabbed', () => {
  it('offers Stock, Reconciliation and Movements', () => {
    renderReport();
    expect(tab('Stock')).toBeTruthy();
    expect(tab('Reconciliation')).toBeTruthy();
    expect(tab('Movements')).toBeTruthy();
  });

  it('opens on Stock', async () => {
    renderReport();
    expect(tab('Stock').getAttribute('data-state')).toBe('active');
    // The dashboard's own card title, not another section's.
    expect(await screen.findByText('Stock dashboard')).toBeTruthy();
  });

  it('shows reconciliation only once its tab is chosen', async () => {
    renderReport();
    expect(screen.queryByText('Reconciled Product')).toBeNull();

    openTab('Reconciliation');

    expect(await screen.findByText('Reconciled Product')).toBeTruthy();
  });

  it('shows movements only once its tab is chosen', async () => {
    renderReport();
    expect(screen.queryByText('Moved Product')).toBeNull();

    openTab('Movements');

    expect(await screen.findByText('Moved Product')).toBeTruthy();
  });

  it('keeps the three panels apart — one tab never renders another\'s table', async () => {
    renderReport();
    openTab('Reconciliation');
    await screen.findByText('Reconciled Product');

    // The movements log is long; if it bled into this panel it would bury the
    // variance the organizer opened the tab for.
    expect(screen.queryByText('Moved Product')).toBeNull();
  });
});

describe('Live stock is gone', () => {
  it('no longer renders a Live stock card', () => {
    renderReport();
    // Third copy of the same board: the Stock levels tab and the Catalogue's
    // On hand column both show it already.
    expect(screen.queryByText('Live stock')).toBeNull();
  });

  it('does not fetch the stock board for this report at all', () => {
    renderReport();
    // Not merely hidden — the query is gone, so the page stops paying for a
    // request whose every column is rendered elsewhere.
    expect(getEventStockBoard).not.toHaveBeenCalled();
  });

  it('still reaches reconciliation and movements, which Live stock used to sit above', async () => {
    renderReport();
    openTab('Movements');
    const panel = await screen.findByRole('tabpanel');
    expect(within(panel).getByText('Moved Product')).toBeTruthy();
  });
});
