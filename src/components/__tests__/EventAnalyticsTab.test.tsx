// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { EventAnalytics, RevenueStats } from '@/types';

// The DateRangePicker pulls in Radix Select/Popover, which need layout APIs
// jsdom doesn't provide. It's irrelevant to the payment-method mapping under
// test, so it's stubbed out rather than fought with.
vi.mock('@/components/DateRangePicker', () => ({
  DateRangePicker: () => null,
}));

vi.mock('@/lib/api', () => ({
  apiClient: {
    analytics: {
      getEventAnalytics: vi.fn(),
      getRevenueStats: vi.fn(),
    },
  },
}));

// Recharts' <Pie> only lays out real sectors once it has non-zero container
// dimensions, which jsdom never reports — so a real PieChart renders an empty
// 0x0 SVG and the label/fill EventAnalyticsTab computed is invisible to a DOM
// query. Replacing Pie with a stand-in that surfaces each data entry's name
// alongside its paired <Cell fill> turns that computed label/color back into
// something assertable, without touching the mapping logic under test (which
// lives entirely in EventAnalyticsTab.tsx, not in this mock).
vi.mock('recharts', async () => {
  const { Children } = await import('react');
  return {
    ResponsiveContainer: ({ children }: any) => children,
    PieChart: ({ children }: any) => <div>{children}</div>,
    Pie: ({ data, children }: any) => (
      <div>
        {data.map((entry: any, index: number) => {
          const cell = Children.toArray(children)[index] as { props?: { fill?: string } };
          return (
            <div key={`${entry.name}-${index}`} data-testid="pie-slice" data-fill={cell?.props?.fill}>
              {entry.name}
            </div>
          );
        })}
      </div>
    ),
    Cell: () => null,
    AreaChart: ({ children }: any) => <div>{children}</div>,
    Area: () => null,
    RadialBarChart: ({ children }: any) => <div>{children}</div>,
    RadialBar: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    Legend: () => null,
  };
});

import { apiClient } from '@/lib/api';
import { EventAnalyticsTab } from '@/components/EventAnalyticsTab';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const baseAnalytics: EventAnalytics = {
  event: { id: 'evt-1', name: 'Piano Republic', venue: 'The Venue', eventDate: '2026-01-01', status: 'published' },
  sales: {
    totalSales: 4,
    totalRevenue: 400,
    ticketsSold: 4,
    tagsPrinted: 0,
    cashSales: 100,
    checkedIn: 0,
    checkInRate: 0,
  },
  ticketTypes: [],
};

function revenueStatsWith(
  revenueByPaymentMethod: RevenueStats['revenueByPaymentMethod'],
): RevenueStats {
  return {
    period: 'all',
    totalRevenue: 400,
    ticketsSold: 4,
    averageTicketPrice: 100,
    revenueByEvent: [],
    revenueByPaymentMethod,
    dailyRevenue: [],
  };
}

function renderTab() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <EventAnalyticsTab eventId="evt-1" />
    </QueryClientProvider>,
  );
}

describe('EventAnalyticsTab payment method breakdown', () => {
  // The bug: the pie's label used an inline ternary that only recognised
  // 'keshless_wallet' and called everything else "Cash", and its Cell fill
  // followed the same shared fallback — so a card sale and a MoMo sale both
  // rendered as an indistinguishable "Cash" slice. The fix reads the label
  // from paymentLabel() and the fill from PAYMENT_METHOD_COLORS[entry.method]
  // (both in src/lib), keyed on the raw method value.
  it('labels and colors card and MoMo distinctly from cash and wallet, not as a shared Cash fallback', async () => {
    vi.mocked(apiClient.analytics.getEventAnalytics).mockResolvedValue(baseAnalytics);
    vi.mocked(apiClient.analytics.getRevenueStats).mockResolvedValue(
      revenueStatsWith([
        { method: 'cash', amount: 100, count: 1 },
        { method: 'peach_card', amount: 100, count: 1 },
        { method: 'mtn_momo', amount: 100, count: 1 },
        { method: 'keshless_wallet', amount: 100, count: 1 },
      ]),
    );

    renderTab();

    const slices = await screen.findAllByTestId('pie-slice');
    expect(slices).toHaveLength(4);

    const byLabel = (label: string) => slices.find((el) => el.textContent === label);

    const cash = byLabel('Cash');
    const card = byLabel('Card');
    const momo = byLabel('MoMo');
    const wallet = byLabel('Wallet');

    // Four distinct payment methods must produce four distinct labels — the
    // exact regression was card/MoMo/etc. collapsing onto "Cash".
    expect(cash).toBeTruthy();
    expect(card).toBeTruthy();
    expect(momo).toBeTruthy();
    expect(wallet).toBeTruthy();

    const fill = (el: HTMLElement | undefined) => el?.getAttribute('data-fill');

    // ...and four distinct fill colors, not all sharing whatever "cash" (or
    // any other single method) mapped to.
    expect(fill(cash)).toBe('#f59e0b');
    expect(fill(card)).toBe('#3b82f6');
    expect(fill(momo)).toBe('#f97316');
    expect(fill(wallet)).toBe('#8b5cf6');

    const fills = new Set([fill(cash), fill(card), fill(momo), fill(wallet)]);
    expect(fills.size).toBe(4);
  });
});
