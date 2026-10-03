import { Fragment, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, ChevronRight, ChevronDown, Download } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, type StockStatus, type StockMovementRow } from '@/lib/api';
import { fmtCents } from '@/lib/money';
import type { Currency } from '@/lib/currency';
import { scopeKey, type StockScope } from '@/lib/stockScope';
import { saveBlob } from '@/lib/ticketDownloads';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * The organiser's STOCK report for one cashless event (Slice 6 / parent §9) or
 * the vendor's venue —
 * the stock dashboard, reconciliation and a movements log, one per tab. All
 * read-only, each section its own query so one failing section never blanks the
 * rest. Money is integer cents in the `currency` shown (default ZAR, via
 * fmtCents); stock is whole base units.
 *
 * Tabbed rather than stacked: these are three different questions (how did it
 * sell, does the count add up, who moved what), and stacking them put the
 * reconciliation an organizer came for three scrolls below charts they did
 * not. Tabs also mean only the visible section's query runs.
 *
 * The old "Live stock" card is gone. It was the third place on this page
 * showing the same board — the Stock levels tab lists Product / Sold /
 * In stock / Sales / Status per stall, and the Catalogue carries On hand —
 * so it cost a query to repeat columns rendered twice over already.
 */
export function EventStockReport({ scope, currency = 'ZAR' }: { scope: StockScope; currency?: Currency }) {
  return (
    <Tabs defaultValue="stock" className="space-y-4">
      <TabsList>
        <TabsTrigger value="stock">Stock</TabsTrigger>
        <TabsTrigger value="reconciliation">Reconciliation</TabsTrigger>
        <TabsTrigger value="movements">Movements</TabsTrigger>
      </TabsList>

      <TabsContent value="stock">
        <DashboardSection scope={scope} currency={currency} />
      </TabsContent>
      <TabsContent value="reconciliation">
        <ReconciliationSection scope={scope} />
      </TabsContent>
      <TabsContent value="movements">
        <MovementsSection scope={scope} />
      </TabsContent>
    </Tabs>
  );
}

// ---------------------------------------------------------------- helpers
const STATUS_META: Record<StockStatus, { label: string; className: string }> = {
  in_stock: { label: 'In stock', className: 'bg-slate-100 text-slate-700' },
  low: { label: 'Low', className: 'bg-amber-100 text-amber-800' },
  sold_out: { label: 'Sold out', className: 'bg-red-100 text-red-700' },
};
function StatusPill({ status }: { status: StockStatus }) {
  const m = STATUS_META[status] ?? STATUS_META.in_stock;
  return <Badge variant="secondary" className={m.className}>{m.label}</Badge>;
}

function SectionState({ loading, error, empty, emptyText, children }: {
  loading: boolean; error: boolean; empty: boolean; emptyText: string; children: React.ReactNode;
}) {
  if (loading) return <div className="flex items-center py-8 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…</div>;
  if (error) return <p className="text-sm text-muted-foreground py-6">Could not load this section.</p>;
  if (empty) return <p className="text-sm text-muted-foreground py-6">{emptyText}</p>;
  return <>{children}</>;
}

// ---------------------------------------------------------------- dashboard
function DashboardSection({ scope, currency }: { scope: StockScope; currency: Currency }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['event-stock-dashboard', scopeKey(scope)],
    queryFn: () => apiClient.stock.dashboard(scope),
    retry: false,
  });

  const totalRevenue = (data?.itemisedSplit.itemised.gross ?? 0) + (data?.itemisedSplit.unitemised.gross ?? 0);
  const itemisedPct = totalRevenue > 0 ? Math.round((data!.itemisedSplit.itemised.gross / totalRevenue) * 100) : 0;
  const peakMax = Math.max(1, ...(data?.peakTimes ?? []).map((h) => h.units));

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Stock dashboard</CardTitle></CardHeader>
      <CardContent>
        <SectionState loading={isLoading} error={!!error} empty={!data} emptyText="No sales yet.">
          {data && (
            <div className="space-y-6">
              {/* Revenue split */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Itemised vs un-itemised revenue</span>
                  <span className="font-semibold">{fmtCents(totalRevenue, currency)}</span>
                </div>
                <div className="flex h-3 rounded-full overflow-hidden bg-slate-100">
                  <div className="bg-orange-500" style={{ width: `${itemisedPct}%` }} title={`Itemised ${fmtCents(data.itemisedSplit.itemised.gross, currency)}`} />
                  <div className="bg-slate-400" style={{ width: `${100 - itemisedPct}%` }} title={`Un-itemised ${fmtCents(data.itemisedSplit.unitemised.gross, currency)}`} />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>Itemised {fmtCents(data.itemisedSplit.itemised.gross, currency)} ({itemisedPct}%)</span>
                  <span>Un-itemised {fmtCents(data.itemisedSplit.unitemised.gross, currency)}</span>
                </div>
              </div>

              {/* Best sellers */}
              <TwoColTable title="Best sellers" rows={data.bestSellers.map((p) => ({ k: p.productId, label: p.productName, right: `${p.units} · ${fmtCents(p.revenue, currency)}` }))} emptyText="No itemised sales yet." />

              {/* Sales by stall */}
              <TwoColTable title="Sales by stall" rows={data.salesByBar.map((b) => ({ k: b.merchantId, label: b.merchantName, right: `${fmtCents(b.gross, currency)} · ${b.count}` }))} emptyText="No charges yet." />

              {/* Sales by employee */}
              <TwoColTable title="Sales by till" rows={data.salesByEmployee.map((e, i) => ({ k: `${e.staffName ?? 'none'}-${i}`, label: e.label, right: `${fmtCents(e.gross, currency)} · ${e.count}` }))} emptyText="No charges yet." />

              {/* Peak times */}
              <div>
                <div className="text-sm font-medium mb-2">Peak selling times <span className="text-muted-foreground font-normal">(units/hr, local time)</span></div>
                <div className="flex items-end gap-[3px] h-20">
                  {data.peakTimes.map((h) => (
                    <div key={h.hour} className="flex-1 flex flex-col items-center justify-end" title={`${h.hour}:00 — ${h.units} units`}>
                      <div className="w-full bg-orange-400 rounded-sm" style={{ height: `${(h.units / peakMax) * 100}%` }} />
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1"><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div>
              </div>

              {/* Predicted stock-out */}
              <div>
                <div className="text-sm font-medium mb-2">Predicted to run out</div>
                {data.predictedStockOut.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nothing selling fast enough to predict{data.noRecentSales > 0 ? ` (${data.noRecentSales} with no recent sales)` : ''}.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Stall</TableHead><TableHead className="text-right">On hand</TableHead><TableHead className="text-right">≈ time to out</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {data.predictedStockOut.slice(0, 10).map((r) => (
                          <TableRow key={`${r.productId}-${r.merchantId}`}>
                            <TableCell className="font-medium">{r.productName}</TableCell>
                            <TableCell className="text-muted-foreground">{r.merchantName}</TableCell>
                            <TableCell className="text-right">{r.onHand}</TableCell>
                            <TableCell className="text-right font-semibold">{fmtMinutes(r.minutesToStockOut)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {data.predictedStockOut.length > 10 && (
                      <p className="text-xs text-muted-foreground pt-1">+{data.predictedStockOut.length - 10} more</p>
                    )}
                  </div>
                )}
              </div>

              {data.totalShrinkageUnits < 0 && (
                <p className="text-sm text-red-700">Total counted shrinkage: {data.totalShrinkageUnits} units</p>
              )}
            </div>
          )}
        </SectionState>
      </CardContent>
    </Card>
  );
}

function TwoColTable({ title, rows, emptyText }: { title: string; rows: { k: string; label: string; right: string }[]; emptyText: string }) {
  return (
    <div>
      <div className="text-sm font-medium mb-2">{title}</div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <div className="space-y-1">
          {rows.slice(0, 10).map((r) => (
            <div key={r.k} className="flex justify-between text-sm border-b border-slate-100 pb-1">
              <span>{r.label}</span>
              <span className="text-muted-foreground">{r.right}</span>
            </div>
          ))}
          {rows.length > 10 && (
            <p className="text-xs text-muted-foreground pt-1">+{rows.length - 10} more</p>
          )}
        </div>
      )}
    </div>
  );
}

function fmtMinutes(mins: number): string {
  if (!Number.isFinite(mins)) return '—';
  if (mins < 60) return `${Math.round(mins)} min`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

// ---------------------------------------------------------------- reconciliation
/** Inclusive local days → the API's [from, to) instants (Eswatini is UTC+2, no DST). */
function dayRange(fromDay: string, toDay: string): { from: string; to: string } {
  const next = new Date(`${toDay}T00:00:00+02:00`);
  next.setUTCDate(next.getUTCDate() + 1);
  const nextDay = next.toLocaleDateString('en-CA', { timeZone: 'Africa/Mbabane' });
  return { from: `${fromDay}T00:00:00+02:00`, to: `${nextDay}T00:00:00+02:00` };
}

function ReconciliationSection({ scope }: { scope: StockScope }) {
  // Venue reports are by day (Eswatini, UTC+2): an inclusive From–To date pair.
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Mbabane' });
  const [fromDay, setFromDay] = useState(today);
  const [toDay, setToDay] = useState(today);
  // A cleared date input yields '' — a half-picked range is not a range, so
  // neither the table nor the PDF is asked for one until both days are set.
  const rangeIncomplete = scope.kind === 'venue' && (!fromDay || !toDay);
  const range = scope.kind === 'venue' && !rangeIncomplete ? dayRange(fromDay, toDay) : undefined;

  const { data, isLoading, error } = useQuery({
    queryKey: ['event-stock-recon', scopeKey(scope), range?.from, range?.to],
    queryFn: () => apiClient.stock.reconciliation(scope, range),
    enabled: !rangeIncomplete,
    retry: false,
  });
  const num = (n: number | null) => (n == null ? '—' : n);
  const variance = (v: number | null) =>
    v == null ? <span className="text-muted-foreground">—</span> : <span className={v < 0 ? 'text-red-700 font-semibold' : v > 0 ? 'text-green-700' : ''}>{v}</span>;

  // Deliberately not a react-query mutation: there is nothing to cache or
  // invalidate, and the PDF is rebuilt server-side on every request so that it
  // reports the position as at the moment it was asked for.
  const [downloading, setDownloading] = useState(false);
  const handleDownload = async () => {
    setDownloading(true);
    try {
      const blob = await apiClient.stock.reconciliationPdf(scope, range);
      // The server puts the real filename in Content-Disposition, which a
      // programmatic save cannot read — so rebuild the same shape from the
      // event (or venue) name the report already returned, and fall back to the date
      // alone if the report has not loaded.
      const slug = (data?.event?.name ?? data?.venue?.name ?? '').replace(/[^a-zA-Z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
      const date = new Date().toISOString().slice(0, 10);
      saveBlob(blob, `stock-reconciliation-${slug ? `${slug}-` : ''}${date}.pdf`);
    } catch (err) {
      // Loud: an organiser who is handed a silently empty file finds out at
      // the stall, with the manager waiting.
      toast.error(err instanceof Error ? err.message : 'Could not build the reconciliation PDF');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Reconciliation</CardTitle>
        <Button size="sm" variant="outline" disabled={downloading || rangeIncomplete} onClick={handleDownload}>
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          <span className="ml-1">Download PDF</span>
        </Button>
      </CardHeader>
      <CardContent>
        {scope.kind === 'venue' && (
          <div className="flex flex-wrap items-end gap-3 pb-4">
            <div className="space-y-1">
              <Label htmlFor="recon-from">From</Label>
              <Input id="recon-from" type="date" value={fromDay} max={toDay} onChange={(e) => setFromDay(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="recon-to">To</Label>
              <Input id="recon-to" type="date" value={toDay} min={fromDay} onChange={(e) => setToDay(e.target.value)} />
            </div>
          </div>
        )}
        <SectionState
          loading={isLoading}
          error={!!error}
          empty={rangeIncomplete || !data || data.byProduct.length === 0}
          emptyText={rangeIncomplete ? 'Pick both dates' : 'No stock movements yet.'}
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Opening</TableHead>
                  <TableHead className="text-right">Added</TableHead>
                  <TableHead className="text-right">In</TableHead>
                  <TableHead className="text-right">Out</TableHead>
                  <TableHead className="text-right">Sold</TableHead>
                  <TableHead className="text-right">Expected</TableHead>
                  <TableHead className="text-right">Physical</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.byProduct ?? []).map((r) => (
                  <TableRow key={r.productId}>
                    <TableCell className="font-medium">{r.productName}</TableCell>
                    <TableCell className="text-right">{r.opening}</TableCell>
                    <TableCell className="text-right">{r.added}</TableCell>
                    <TableCell className="text-right">{r.transferIn}</TableCell>
                    <TableCell className="text-right">{r.transferOut}</TableCell>
                    <TableCell className="text-right">{r.sold}</TableCell>
                    <TableCell className="text-right font-semibold">{r.expectedClosing}</TableCell>
                    <TableCell className="text-right">{num(r.physicalCount)}</TableCell>
                    <TableCell className="text-right">{variance(r.variance)}</TableCell>
                  </TableRow>
                ))}
                {data && (
                  <TableRow className="border-t-2 font-semibold">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">{data.total.opening}</TableCell>
                    <TableCell className="text-right">{data.total.added}</TableCell>
                    <TableCell className="text-right">{data.total.transferIn}</TableCell>
                    <TableCell className="text-right">{data.total.transferOut}</TableCell>
                    <TableCell className="text-right">{data.total.sold}</TableCell>
                    <TableCell className="text-right">{data.total.expectedClosing}</TableCell>
                    <TableCell className="text-right">{num(data.total.physicalCount)}</TableCell>
                    <TableCell className="text-right">{variance(data.total.variance)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </SectionState>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------- movements
const REASON_CLASS: Record<string, string> = {
  receive: 'bg-green-100 text-green-800',
  sale: 'bg-blue-100 text-blue-800',
  transfer_in: 'bg-teal-100 text-teal-800',
  transfer_out: 'bg-orange-100 text-orange-800',
  count_adjust: 'bg-purple-100 text-purple-800',
  spoilage: 'bg-red-100 text-red-800',
  manual: 'bg-gray-100 text-gray-800',
};
const fmtTime = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('en-ZA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

function MovementsSection({ scope }: { scope: StockScope }) {
  const [pages, setPages] = useState<StockMovementRow[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const { isLoading, error } = useQuery({
    queryKey: ['event-stock-movements', scopeKey(scope)],
    queryFn: async () => {
      const res = await apiClient.stock.movements(scope, { limit: 50 });
      setPages(res.movements);
      setCursor(res.nextCursor ?? undefined);
      setHasMore(res.hasMore);
      return res;
    },
    retry: false,
    // The pager accumulates pages in local state; a background refetch would
    // reset it to page 1 without warning. Fetch once per mount only.
    staleTime: Infinity,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });

  const loadMore = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const res = await apiClient.stock.movements(scope, { limit: 50, cursor });
      setPages((p) => [...p, ...res.movements]);
      setCursor(res.nextCursor ?? undefined);
      setHasMore(res.hasMore);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Recent movements</CardTitle></CardHeader>
      <CardContent>
        <SectionState loading={isLoading} error={!!error} empty={pages.length === 0} emptyText="No movements yet.">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="hidden sm:table-cell">When</TableHead>
                  <TableHead>Stall</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="hidden md:table-cell">Who</TableHead>
                  <TableHead className="text-right">Δ</TableHead>
                  <TableHead className="text-right">After</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pages.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-muted-foreground hidden sm:table-cell">{fmtTime(m.at)}</TableCell>
                    <TableCell>{m.merchantName}</TableCell>
                    <TableCell className="font-medium">{m.productName}</TableCell>
                    <TableCell><Badge variant="secondary" className={REASON_CLASS[m.reason] ?? 'bg-gray-100 text-gray-800'}>{m.reason}</Badge></TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {m.byName ?? '—'}
                    </TableCell>
                    <TableCell className={`text-right font-medium ${m.delta < 0 ? 'text-red-700' : 'text-green-700'}`}>{m.delta > 0 ? `+${m.delta}` : m.delta}</TableCell>
                    <TableCell className="text-right">{m.balanceAfter}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {hasMore && (
              <div className="pt-3">
                <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Load more
                </Button>
              </div>
            )}
          </div>
        </SectionState>
      </CardContent>
    </Card>
  );
}
