import { Fragment, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, ChevronRight, ChevronDown } from 'lucide-react';
import { apiClient, type StockStatus, type StockMovementRow } from '@/lib/api';
import { fmtR } from '@/lib/money';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

/**
 * The organiser's STOCK report for one cashless event (Slice 6 / parent §9) —
 * live board, event stock dashboard, reconciliation and a movements log. All
 * read-only, each section its own query so one failing section never blanks the
 * rest. Money is ZAR cents (fmtR); stock is whole base units.
 */
export function EventStockReport({ eventId }: { eventId: string }) {
  return (
    <div className="space-y-6">
      <BoardSection eventId={eventId} />
      <DashboardSection eventId={eventId} />
      <ReconciliationSection eventId={eventId} />
      <MovementsSection eventId={eventId} />
    </div>
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

// ---------------------------------------------------------------- board
function BoardSection({ eventId }: { eventId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['event-stock-board', eventId],
    queryFn: () => apiClient.events.getEventStockBoard(eventId),
    retry: false,
  });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setExpanded((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const barsByProduct = useMemo(() => {
    const m = new Map<string, typeof data.perBar>() as Map<string, NonNullable<typeof data>['perBar']>;
    (data?.perBar ?? []).forEach((r) => { const a = m.get(r.productId) ?? []; a.push(r); m.set(r.productId, a); });
    return m;
  }, [data]);

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Live stock</CardTitle></CardHeader>
      <CardContent>
        <SectionState loading={isLoading} error={!!error} empty={!data || data.byProduct.length === 0} emptyText="No stock loaded yet.">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">On hand</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.byProduct ?? []).map((p) => {
                  const bars = barsByProduct.get(p.productId) ?? [];
                  const expandable = bars.length > 1;
                  const open = expandable && expanded.has(p.productId);
                  return (
                    <Fragment key={p.productId}>
                      <TableRow className={expandable ? 'cursor-pointer hover:bg-slate-50' : ''} onClick={expandable ? () => toggle(p.productId) : undefined}>
                        <TableCell>{expandable ? (open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />) : null}</TableCell>
                        <TableCell className="font-medium">{p.productName}</TableCell>
                        <TableCell className="text-right font-semibold">{p.totalOnHand}</TableCell>
                        <TableCell><StatusPill status={p.status} /></TableCell>
                      </TableRow>
                      {open && bars.map((b) => (
                        <TableRow key={`${p.productId}-${b.merchantId}`} className="bg-slate-50/50 text-sm">
                          <TableCell />
                          <TableCell className="pl-6 text-muted-foreground">{b.merchantName}</TableCell>
                          <TableCell className="text-right">{b.onHand}</TableCell>
                          <TableCell><StatusPill status={b.status} /></TableCell>
                        </TableRow>
                      ))}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </SectionState>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------- dashboard
function DashboardSection({ eventId }: { eventId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['event-stock-dashboard', eventId],
    queryFn: () => apiClient.events.getEventStockDashboard(eventId),
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
                  <span className="font-semibold">{fmtR(totalRevenue)}</span>
                </div>
                <div className="flex h-3 rounded-full overflow-hidden bg-slate-100">
                  <div className="bg-orange-500" style={{ width: `${itemisedPct}%` }} title={`Itemised ${fmtR(data.itemisedSplit.itemised.gross)}`} />
                  <div className="bg-slate-400" style={{ width: `${100 - itemisedPct}%` }} title={`Un-itemised ${fmtR(data.itemisedSplit.unitemised.gross)}`} />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>Itemised {fmtR(data.itemisedSplit.itemised.gross)} ({itemisedPct}%)</span>
                  <span>Un-itemised {fmtR(data.itemisedSplit.unitemised.gross)}</span>
                </div>
              </div>

              {/* Best sellers */}
              <TwoColTable title="Best sellers" rows={data.bestSellers.map((p) => ({ k: p.productId, label: p.productName, right: `${p.units} · ${fmtR(p.revenue)}` }))} emptyText="No itemised sales yet." />

              {/* Sales by bar */}
              <TwoColTable title="Sales by bar" rows={data.salesByBar.map((b) => ({ k: b.merchantId, label: b.merchantName, right: `${fmtR(b.gross)} · ${b.count}` }))} emptyText="No charges yet." />

              {/* Sales by employee */}
              <TwoColTable title="Sales by till" rows={data.salesByEmployee.map((e, i) => ({ k: `${e.staffName ?? 'none'}-${i}`, label: e.label, right: `${fmtR(e.gross)} · ${e.count}` }))} emptyText="No charges yet." />

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
                      <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Bar</TableHead><TableHead className="text-right">On hand</TableHead><TableHead className="text-right">≈ time to out</TableHead></TableRow></TableHeader>
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
function ReconciliationSection({ eventId }: { eventId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['event-stock-recon', eventId],
    queryFn: () => apiClient.events.getEventStockReconciliation(eventId),
    retry: false,
  });
  const num = (n: number | null) => (n == null ? '—' : n);
  const variance = (v: number | null) =>
    v == null ? <span className="text-muted-foreground">—</span> : <span className={v < 0 ? 'text-red-700 font-semibold' : v > 0 ? 'text-green-700' : ''}>{v}</span>;

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Reconciliation</CardTitle></CardHeader>
      <CardContent>
        <SectionState loading={isLoading} error={!!error} empty={!data || data.byProduct.length === 0} emptyText="No stock movements yet.">
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

function MovementsSection({ eventId }: { eventId: string }) {
  const [pages, setPages] = useState<StockMovementRow[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const { isLoading, error } = useQuery({
    queryKey: ['event-stock-movements', eventId],
    queryFn: async () => {
      const res = await apiClient.events.getEventStockMovements(eventId, { limit: 50 });
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
      const res = await apiClient.events.getEventStockMovements(eventId, { limit: 50, cursor });
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
                  <TableHead>Bar</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Reason</TableHead>
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
