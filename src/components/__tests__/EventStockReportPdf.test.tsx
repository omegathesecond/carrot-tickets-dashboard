// @vitest-environment jsdom
//
// "stock recon at the end of the day for the stalls and stock should be
// downloadable by pdf" — 2026-09-29
//
// Organisers cash the stalls up at the end of an event and hand each stall
// manager their own sheet. The figures were on screen but there was no way to
// get them onto paper.
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EventStockReport } from '@/components/EventStockReport';

const getEventStockBoard = vi.fn();
const getEventStockDashboard = vi.fn();
const getEventStockReconciliation = vi.fn();
const getEventStockMovements = vi.fn();
const getEventStockReconciliationPdf = vi.fn();
const saveBlob = vi.fn();
const toastError = vi.fn();

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
        getEventStockReconciliationPdf: (...a: unknown[]) => getEventStockReconciliationPdf(...a),
      },
    },
  };
});

vi.mock('@/lib/ticketDownloads', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ticketDownloads')>();
  return { ...actual, saveBlob: (...a: unknown[]) => saveBlob(...a) };
});

vi.mock('sonner', () => ({ toast: { error: (...a: unknown[]) => toastError(...a) } }));

function renderReport() {
  getEventStockBoard.mockResolvedValue({ event: { id: 'e1', name: 'Event' }, perBar: [], byProduct: [] });
  getEventStockDashboard.mockResolvedValue({
    event: { id: 'e1', name: 'Event' },
    revenueByProduct: [], bestSellers: [], salesByBar: [], salesByEmployee: [],
    itemisedSplit: { itemised: { gross: 0, count: 0 }, unitemised: { gross: 0, count: 0 } },
    peakTimes: [], variances: [], totalShrinkageUnits: 0, predictedStockOut: [], noRecentSales: 0,
  });
  getEventStockReconciliation.mockResolvedValue({
    event: { id: 'e1', name: 'Ocean Summer Vibes' },
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
  });
  getEventStockMovements.mockResolvedValue({ movements: [], nextCursor: null, hasMore: false });

  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <EventStockReport eventId="e1" />
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

// This project does not load @testing-library/jest-dom, so `disabled` is read
// off the element rather than through a `toBeDisabled` matcher.
const downloadButton = () => screen.getByRole('button', { name: /download pdf/i }) as HTMLButtonElement;

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('the reconciliation can be downloaded as a PDF', () => {
  it('fetches the PDF and hands it to the browser', async () => {
    const blob = new Blob(['%PDF-'], { type: 'application/pdf' });
    getEventStockReconciliationPdf.mockResolvedValue(blob);
    renderReport();
    openReconciliation();
    // Wait for the table, so the event name the filename is built from has
    // arrived — clicking before it does falls back to a date-only name.
    await screen.findByText('Castle Lite');

    fireEvent.click(downloadButton());

    await waitFor(() => expect(getEventStockReconciliationPdf).toHaveBeenCalledWith('e1'));
    await waitFor(() => expect(saveBlob).toHaveBeenCalled());
    expect(saveBlob.mock.calls[0]![0]).toBe(blob);
    // Named after the event, so an organiser downloading two events' recons in
    // one sitting does not end up with two identically-named files.
    expect(String(saveBlob.mock.calls[0]![1])).toMatch(/^stock-reconciliation-Ocean-Summer-Vibes-\d{4}-\d{2}-\d{2}\.pdf$/);
  });

  it('surfaces a failure instead of saving an empty file', async () => {
    getEventStockReconciliationPdf.mockRejectedValue(new Error('Session expired. Please log in again.'));
    renderReport();
    openReconciliation();

    fireEvent.click(await screen.findByRole('button', { name: /download pdf/i }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Session expired. Please log in again.'));
    // A silent fallback here would hand the organiser a file they would only
    // discover was empty after they had handed it to a stall manager.
    expect(saveBlob).not.toHaveBeenCalled();
  });

  it('blocks a second click while the first download is in flight', async () => {
    let release: (b: Blob) => void = () => {};
    getEventStockReconciliationPdf.mockReturnValue(new Promise<Blob>((r) => { release = r; }));
    renderReport();
    openReconciliation();

    fireEvent.click(await screen.findByRole('button', { name: /download pdf/i }));
    await waitFor(() => expect(downloadButton().disabled).toBe(true));
    fireEvent.click(downloadButton());
    expect(getEventStockReconciliationPdf).toHaveBeenCalledTimes(1);

    release(new Blob(['%PDF-']));
    await waitFor(() => expect(downloadButton().disabled).toBe(false));
  });
});
