// @vitest-environment jsdom
//
// The catalogue panel speaks to its owner: at a venue the copy says "venue" and
// the price field carries the venue's currency symbol. An event keeps its copy
// and its "R" word for word.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { EventCataloguePanel } from '@/components/cashless/EventCataloguePanel';
import type { StockScope } from '@/lib/stockScope';
import type { Currency } from '@/lib/currency';

const listProducts = vi.fn();
const listMerchants = vi.fn();
const stockBoard = vi.fn();
const getAllocations = vi.fn();

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    apiClient: {
      stock: {
        listProducts: (...a: unknown[]) => listProducts(...a),
        board: (...a: unknown[]) => stockBoard(...a),
        getAllocations: (...a: unknown[]) => getAllocations(...a),
      },
      merchants: { list: (...a: unknown[]) => listMerchants(...a) },
    },
  };
});

const BAR = { _id: 'm-bar', name: 'Main Bar', commissionPercent: 0, status: 'active', createdAt: '' };
const BEER = {
  _id: 'p-beer', name: 'Castle Lite 330ml', category: 'beer', price: 2500,
  barcode: null, imageUrl: null, unitLabel: 'unit', unitsPerPack: null, packLabel: null, active: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  listProducts.mockResolvedValue([BEER]);
  listMerchants.mockResolvedValue([BAR]);
  stockBoard.mockResolvedValue({ perBar: [], byProduct: [] });
  getAllocations.mockResolvedValue({ allocations: {} });
});
afterEach(cleanup);

const VENUE: StockScope = { kind: 'venue' };
const EVENT: StockScope = { kind: 'event', eventId: 'e1' };

// ?view=catalogue: Radix unmounts an inactive TabsContent, so "Add product"
// and the price list exist only on the catalogue view.
function renderPanel(scope: StockScope, currency?: Currency) {
  render(
    <MemoryRouter initialEntries={['/venue?tab=catalogue&view=catalogue']}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <EventCataloguePanel scope={scope} currency={currency} />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

const openAdd = async () => {
  fireEvent.click(await screen.findByRole('button', { name: /add product/i }));
};

describe('EventCataloguePanel wording per owner', () => {
  it("a venue's copy says venue and its price field carries the venue currency", async () => {
    renderPanel(VENUE, 'SZL');
    expect(screen.getByText("What this venue's stalls sell — priced per unit, stocked per stall")).toBeTruthy();
    await openAdd();
    expect(await screen.findByText('Price (E per unit)')).toBeTruthy();
    expect(screen.queryByText('Price (R per unit)')).toBeNull();
  });

  it('a venue whose stalls fail to load is told this venue may already have stalls', async () => {
    listMerchants.mockRejectedValue(new Error('Forbidden'));
    renderPanel(VENUE, 'SZL');
    await openAdd();
    expect(await screen.findByText(/^Stalls could not be loaded — this venue may already have stalls,/)).toBeTruthy();
  });

  it('an event keeps its copy, and the default currency still reads R', async () => {
    renderPanel(EVENT);
    expect(screen.getByText("What this event's stalls sell — priced per unit, stocked per stall")).toBeTruthy();
    await openAdd();
    expect(await screen.findByText('Price (R per unit)')).toBeTruthy();
  });

  it('an event whose stalls fail to load keeps the event copy', async () => {
    listMerchants.mockRejectedValue(new Error('Forbidden'));
    renderPanel(EVENT);
    await openAdd();
    expect(await screen.findByText(
      'Stalls could not be loaded — this event may already have stalls, so this is not necessarily a setup problem. This product will not be assigned to a stall until it is saved again once stalls load.',
    )).toBeTruthy();
  });
});
