import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CreditCard, ArrowDownCircle, ArrowUpCircle, Wallet, Loader2, ArrowRight } from 'lucide-react';
import { TransactionDetailDialog, type TxnDetail } from '@/components/TransactionDetailDialog';
import { EventStockReport } from '@/components/EventStockReport';
import { EventStallsPanel } from '@/components/cashless/EventStallsPanel';
import { EventCataloguePanel } from '@/components/cashless/EventCataloguePanel';
import { CashiersPanel } from '@/components/CashiersPanel';
import { useAuth } from '@/contexts/AuthContext';
import { canManageAccess, canManageStock } from '@/lib/permissions';

/** Cashless wallet amounts move in ZAR cents on the wire. */
const fmtR = (cents: number) => `R${((cents ?? 0) / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtTime = (iso: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('en-ZA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const TXN_LABEL: Record<string, { label: string; className: string }> = {
  topup: { label: 'Top-up', className: 'bg-green-100 text-green-800' },
  withdrawal: { label: 'Cash-out', className: 'bg-orange-100 text-orange-800' },
  purchase: { label: 'Purchase', className: 'bg-blue-100 text-blue-800' },
};

interface Props {
  eventId: string;
}

/**
 * Everything cashless for ONE event. Money is the organizer's report — "you're
 * in charge, here's every rand that moved" (totals, per-stall takings,
 * per-cashier activity, transaction log, all from the authoritative ledger).
 * Stock reports on the stock journal, while Stalls and Catalogue manage the
 * merchants and products that belong to this event. Stalls, products and stock
 * are all eventId-bound in the model, so they live here rather than on a
 * top-level page that asks which event you meant.
 */
export function EventCashlessTab({ eventId }: Props) {
  const {
    data: summary,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['event-cashless-summary', eventId],
    queryFn: () => apiClient.events.getEventCashlessSummary(eventId),
    retry: false,
  });

  const { data: txns } = useQuery({
    queryKey: ['event-cashless-txns', eventId],
    queryFn: () => apiClient.events.getEventCashlessTransactions(eventId, { limit: 50 }),
    retry: false,
    enabled: !!summary,
  });

  const [selected, setSelected] = useState<TxnDetail | null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const showStalls = canManageAccess(user);
  const showCatalogue = canManageStock(user);
  // Same gate as Stalls: cashiers are the organizer's own in-venue staff, so
  // whoever can manage stall access can manage the money desk too.
  const showCashiers = canManageAccess(user);
  const requestedSub = searchParams.get('sub') ?? 'money';
  // Fall back to Money rather than render an empty pane when the URL names a
  // sub-tab this user can't see (shared link, or permissions changed).
  const sub =
    (requestedSub === 'stalls' && !showStalls)
    || (requestedSub === 'catalogue' && !showCatalogue)
    || (requestedSub === 'cashiers' && !showCashiers)
      ? 'money'
      : requestedSub;
  const setSub = (v: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('sub', v);
    setSearchParams(next, { replace: true });
  };

  const moneyBody = isLoading ? (
    <div className="flex items-center justify-center py-16 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading cashless report…
    </div>
  ) : error || !summary ? (
    <Card>
      <CardContent className="py-12 text-center text-muted-foreground">
        {String((error as Error)?.message || '').toLowerCase().includes('not cashless')
          ? 'This event is not a cashless event.'
          : 'Could not load the cashless report.'}
      </CardContent>
    </Card>
  ) : (
    <div className="space-y-6">
      {/* Totals */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<CreditCard className="h-4 w-4" />} label="Circulated" value={fmtR(summary.circulated)} hint="loaded onto bands" tone="ink" />
        <StatCard icon={<ArrowUpCircle className="h-4 w-4" />} label="Spent" value={fmtR(summary.spent)} hint="at stalls" tone="blue" />
        <StatCard icon={<ArrowDownCircle className="h-4 w-4" />} label="Withdrawn" value={fmtR(summary.withdrawn)} hint="handed back" tone="orange" />
        <StatCard icon={<Wallet className="h-4 w-4" />} label="Left behind" value={fmtR(summary.leftBehind)} hint="still on bands" tone="green" />
      </div>

      <div className="text-sm text-muted-foreground">
        {summary.walletsFunded} wallet{summary.walletsFunded === 1 ? '' : 's'} funded · {fmtR(summary.fees)} platform fees collected
      </div>

      {/* Per-stall takings */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Stall takings</CardTitle>
          {showStalls && (
            <button type="button" onClick={() => setSub('stalls')}
              className="text-xs font-medium text-orange-600 hover:text-orange-700 inline-flex items-center gap-1">
              Manage stalls <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </CardHeader>
        <CardContent>
          {summary.vendors.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No stall charges yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Stall</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Commission</TableHead>
                    <TableHead className="text-right">Net owed</TableHead>
                    <TableHead className="text-right">Charges</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.vendors.map((v) => (
                    <TableRow
                      key={v.merchantId}
                      className="cursor-pointer hover:bg-slate-50"
                      onClick={() => navigate(`/events/${eventId}/stalls/${v.merchantId}`)}
                    >
                      <TableCell className="font-medium text-orange-700">{v.name}</TableCell>
                      <TableCell className="text-right">{fmtR(v.gross)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{fmtR(v.commission)}</TableCell>
                      <TableCell className="text-right font-semibold">{fmtR(v.net)}</TableCell>
                      <TableCell className="text-right">{v.chargeCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Per-cashier activity */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Cashier activity</CardTitle>
          {showCashiers && (
            <button type="button" onClick={() => setSub('cashiers')}
              className="text-xs font-medium text-orange-600 hover:text-orange-700 inline-flex items-center gap-1">
              Manage cashiers <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </CardHeader>
        <CardContent>
          {summary.cashiers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No cashier activity yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cashier</TableHead>
                    <TableHead className="text-right">Topped up</TableHead>
                    <TableHead className="text-right">Cashed out</TableHead>
                    <TableHead className="text-right">Transactions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.cashiers.map((c) => (
                    <TableRow
                      key={c.cashierId}
                      className="cursor-pointer hover:bg-slate-50"
                      onClick={() => navigate(`/cashiers/${c.cashierId}`)}
                    >
                      <TableCell className="font-medium text-orange-700">{c.name}</TableCell>
                      <TableCell className="text-right text-green-700">{fmtR(c.toppedUp)}</TableCell>
                      <TableCell className="text-right text-orange-700">{fmtR(c.withdrawn)}</TableCell>
                      <TableCell className="text-right">{c.txnCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transaction log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transaction log</CardTitle>
        </CardHeader>
        <CardContent>
          {!txns || txns.transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No transactions yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>By</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="hidden sm:table-cell">When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {txns.transactions.map((t) => {
                    const meta = TXN_LABEL[t.type] ?? { label: t.type, className: 'bg-gray-100 text-gray-800' };
                    return (
                      <TableRow
                        key={t.id}
                        className="cursor-pointer hover:bg-slate-50"
                        onClick={() => setSelected({
                          id: t.id, type: t.type, amount: t.amount, at: t.at,
                          actorName: t.actorName, actorType: t.actorType,
                          bandUid: t.bandUid, fee: t.fee, netAmount: t.netAmount,
                        })}
                      >
                        <TableCell>
                          <Badge variant="secondary" className={meta.className}>{meta.label}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{t.actorName ?? '—'}</TableCell>
                        <TableCell className="text-right font-medium">{fmtR(t.amount)}</TableCell>
                        <TableCell className="text-muted-foreground hidden sm:table-cell">{fmtTime(t.at)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {txns.hasMore && (
                <p className="text-xs text-muted-foreground mt-3">Showing the most recent 50 transactions.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <TransactionDetailDialog txn={selected} onClose={() => setSelected(null)} />
    </div>
  );

  return (
    <Tabs value={sub} onValueChange={setSub} className="space-y-4">
      <TabsList>
        <TabsTrigger value="money">Money</TabsTrigger>
        <TabsTrigger value="stock">Stock</TabsTrigger>
        {showStalls && <TabsTrigger value="stalls">Stalls</TabsTrigger>}
        {showCatalogue && <TabsTrigger value="catalogue">Catalogue</TabsTrigger>}
        {showCashiers && <TabsTrigger value="cashiers">Cashiers</TabsTrigger>}
      </TabsList>
      <TabsContent value="money">{moneyBody}</TabsContent>
      <TabsContent value="stock">
        <EventStockReport eventId={eventId} />
      </TabsContent>
      {showStalls && (
        <TabsContent value="stalls">
          <EventStallsPanel eventId={eventId} />
        </TabsContent>
      )}
      {showCatalogue && (
        <TabsContent value="catalogue">
          <EventCataloguePanel eventId={eventId} />
        </TabsContent>
      )}
      {showCashiers && (
        <TabsContent value="cashiers">
          <CashiersPanel eventId={eventId} />
        </TabsContent>
      )}
    </Tabs>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  tone: 'ink' | 'blue' | 'orange' | 'green';
}) {
  const toneClass = {
    ink: 'text-foreground',
    blue: 'text-blue-600',
    orange: 'text-orange-600',
    green: 'text-green-600',
  }[tone];
  return (
    <Card>
      <CardContent className="pt-6">
        <div className={`flex items-center gap-1.5 text-xs font-medium ${toneClass}`}>
          {icon}
          {label}
        </div>
        <div className="text-2xl font-bold mt-1">{value}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>
      </CardContent>
    </Card>
  );
}
