// @vitest-environment jsdom
//
// A venue has no doors-open moment to reconcile from, so its Reconciliation
// view takes a day range (default today, Eswatini time). An event keeps its
// own window and shows no picker.
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EventStockReport } from '@/components/EventStockReport';
import { apiClient } from '@/lib/api';
import type { StockScope } from '@/lib/stockScope';

const saveBlob = vi.fn();

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    apiClient: {
      stock: {
        dashboard: vi.fn(),
        reconciliation: vi.fn(),
        reconciliationPdf: vi.fn(),
        movements: vi.fn(),
      },
    },
  };
});

vi.mock('@/lib/ticketDownloads', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ticketDownloads')>();
  return { ...actual, saveBlob: (...a: unknown[]) => saveBlob(...a) };
});

const RECON = {
  event: { id: 'e1', name: 'Event' },
  perBar: [],
  byProduct: [{
    productId: 'p1', productName: 'Castle Lite', opening: 10, added: 5,
    transferIn: 0, transferOut: 0, sold: 3, countAdjust: 0, spoilage: 0,
    manual: 0, expectedClosing: 12, physicalCount: 11, variance: -1,
  }],
  total: {
    opening: 10, added: 5, transferIn: 0, transferOut: 0, sold: 3, countAdjust: 0,
    spoilage: 0, manual: 0, expectedClosing: 12, physicalCount: 11, variance: -1,
  },
};

function renderReport(scope: StockScope, currency?: 'SZL' | 'ZAR') {
  (apiClient.stock.dashboard as any).mockResolvedValue({
    event: { id: 'e1', name: 'Event' },
    revenueByProduct: [], bestSellers: [], salesByBar: [], salesByEmployee: [],
    itemisedSplit: { itemised: { gross: 0, count: 0 }, unitemised: { gross: 0, count: 0 } },
    peakTimes: [], variances: [], totalShrinkageUnits: 0, predictedStockOut: [], noRecentSales: 0,
  });
  (apiClient.stock.reconciliation as any).mockResolvedValue(RECON);
  (apiClient.stock.reconciliationPdf as any).mockResolvedValue(new Blob(['%PDF-'], { type: 'application/pdf' }));
  (apiClient.stock.movements as any).mockResolvedValue({ movements: [], nextCursor: null, hasMore: false });

  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <EventStockReport scope={scope} currency={currency} />
    </QueryClientProvider>,
  );
}

/** Radix TabsTrigger selects on POINTER-DOWN, so a bare click leaves it shut. */
const openReconciliation = () => {
  const el = screen.getByRole('tab', { name: 'Reconciliation' });
  fireEvent.pointerDown(el, { button: 0, ctrlKey: false, pointerType: 'mouse' });
  fireEvent.mouseDown(el, { button: 0 });
  fireEvent.click(el);
};

const pickDay = (from: string, to: string) => {
  fireEvent.change(screen.getByLabelText('From'), { target: { value: from } });
  fireEvent.change(screen.getByLabelText('To'), { target: { value: to } });
};

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('EventStockReport reconciliation range', () => {
  it('a venue reconciliation defaults to today and refetches for a chosen day', async () => {
    renderReport({ kind: 'venue' }, 'SZL');
    openReconciliation();
    await waitFor(() => expect(apiClient.stock.reconciliation).toHaveBeenCalled());
    const [scopeArg, rangeArg] = (apiClient.stock.reconciliation as any).mock.calls[0];
    expect(scopeArg).toEqual({ kind: 'venue' });
    expect(rangeArg.to > rangeArg.from).toBe(true);

    pickDay('2026-10-01', '2026-10-01');

    await waitFor(() => expect(apiClient.stock.reconciliation).toHaveBeenLastCalledWith(
      { kind: 'venue' }, { from: '2026-10-01T00:00:00+02:00', to: '2026-10-02T00:00:00+02:00' },
    ));
  });

  it('a venue PDF is asked for the same range as the table', async () => {
    renderReport({ kind: 'venue' }, 'SZL');
    openReconciliation();
    await screen.findByText('Castle Lite');
    pickDay('2026-10-01', '2026-10-01');
    await waitFor(() => expect(apiClient.stock.reconciliation).toHaveBeenLastCalledWith(
      { kind: 'venue' }, { from: '2026-10-01T00:00:00+02:00', to: '2026-10-02T00:00:00+02:00' },
    ));

    fireEvent.click(screen.getByRole('button', { name: /download pdf/i }));

    await waitFor(() => expect(apiClient.stock.reconciliationPdf).toHaveBeenCalledWith(
      { kind: 'venue' }, { from: '2026-10-01T00:00:00+02:00', to: '2026-10-02T00:00:00+02:00' },
    ));
    await waitFor(() => expect(saveBlob).toHaveBeenCalled());
  });

  it('a range crossing a month end rolls the exclusive upper bound to the next month', async () => {
    renderReport({ kind: 'venue' }, 'SZL');
    openReconciliation();
    await screen.findByText('Castle Lite');

    pickDay('2026-09-30', '2026-09-30');

    await waitFor(() => expect(apiClient.stock.reconciliation).toHaveBeenLastCalledWith(
      { kind: 'venue' }, { from: '2026-09-30T00:00:00+02:00', to: '2026-10-01T00:00:00+02:00' },
    ));
  });

  it('an event reconciliation shows no date range and passes no range', async () => {
    renderReport({ kind: 'event', eventId: 'e1' });
    openReconciliation();
    await waitFor(() => expect(apiClient.stock.reconciliation).toHaveBeenCalledWith({ kind: 'event', eventId: 'e1' }, undefined));
    expect(screen.queryByLabelText('From')).toBeNull();
  });
});
