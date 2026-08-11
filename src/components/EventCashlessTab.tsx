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
import { CreditCard, ArrowDownCircle, ArrowUpCircle, Wallet, Loader2 } from 'lucide-react';

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
 * The organizer's cashless report for ONE event — "you're in charge, here's
 * every rand that moved". Totals (circulated / spent / withdrawn / left-behind),
 * per-vendor takings, per-cashier activity, and the full transaction log. All
 * figures come from the authoritative ledger + wallets, server-side.
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading cashless report…
      </div>
    );
  }

  if (error || !summary) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          {String((error as Error)?.message || '').toLowerCase().includes('not cashless')
            ? 'This event is not a cashless event.'
            : 'Could not load the cashless report.'}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Totals */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<CreditCard className="h-4 w-4" />} label="Circulated" value={fmtR(summary.circulated)} hint="loaded onto bands" tone="ink" />
        <StatCard icon={<ArrowUpCircle className="h-4 w-4" />} label="Spent" value={fmtR(summary.spent)} hint="at vendors" tone="blue" />
        <StatCard icon={<ArrowDownCircle className="h-4 w-4" />} label="Withdrawn" value={fmtR(summary.withdrawn)} hint="handed back" tone="orange" />
        <StatCard icon={<Wallet className="h-4 w-4" />} label="Left behind" value={fmtR(summary.leftBehind)} hint="still on bands" tone="green" />
      </div>

      <div className="text-sm text-muted-foreground">
        {summary.walletsFunded} wallet{summary.walletsFunded === 1 ? '' : 's'} funded · {fmtR(summary.fees)} platform fees collected
      </div>

      {/* Per-vendor takings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vendor takings</CardTitle>
        </CardHeader>
        <CardContent>
          {summary.vendors.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No vendor charges yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Commission</TableHead>
                    <TableHead className="text-right">Net owed</TableHead>
                    <TableHead className="text-right">Charges</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.vendors.map((v) => (
                    <TableRow key={v.merchantId}>
                      <TableCell className="font-medium">{v.name}</TableCell>
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
        <CardHeader>
          <CardTitle className="text-base">Cashier activity</CardTitle>
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
                    <TableRow key={c.cashierId}>
                      <TableCell className="font-medium">{c.name}</TableCell>
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
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {txns.transactions.map((t) => {
                    const meta = TXN_LABEL[t.type] ?? { label: t.type, className: 'bg-gray-100 text-gray-800' };
                    return (
                      <TableRow key={t.id}>
                        <TableCell>
                          <Badge variant="secondary" className={meta.className}>{meta.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">{fmtR(t.amount)}</TableCell>
                        <TableCell className="text-muted-foreground">{fmtTime(t.at)}</TableCell>
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
    </div>
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
