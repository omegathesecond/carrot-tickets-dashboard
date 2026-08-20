import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { CashlessSummary } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CreditCard, ArrowDownCircle, ArrowUpCircle, Wallet, Loader2, ArrowRight } from 'lucide-react';
import { EventStockReport } from '@/components/EventStockReport';
import { EventStallsPanel } from '@/components/cashless/EventStallsPanel';
import { EventTagsPanel } from '@/components/cashless/EventTagsPanel';
import { EventCataloguePanel } from '@/components/cashless/EventCataloguePanel';
import { EventRegisterPanel } from '@/components/cashless/EventRegisterPanel';
import { EventTransactionLog } from '@/components/cashless/EventTransactionLog';
import { CashiersPanel } from '@/components/CashiersPanel';
import { useAuth } from '@/contexts/AuthContext';
import { canManageAccess, canManageStock } from '@/lib/permissions';

/** Cashless wallet amounts move in ZAR cents on the wire. */
const fmtR = (cents: number) => `R${((cents ?? 0) / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Props {
  eventId: string;
}

/**
 * Everything cashless for ONE event. Money is the organizer's report — "you're
 * in charge, here's every rand that moved" — split into the four questions it
 * actually answers: what moved (transactions), what the desk did (cashiers),
 * what the stalls took, and what is still sitting on tags (balances). Stock
 * reports on the stock journal; Register, Stalls, Catalogue and Cashiers manage
 * the people and products behind it all. Stalls, products and stock are all
 * eventId-bound in the model, so they live here rather than on a top-level page
 * that asks which event you meant.
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

  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const showStalls = canManageAccess(user);
  const showCatalogue = canManageStock(user);
  // Same gate as Stalls: cashiers and the register desk are the organizer's own
  // in-venue staff, so whoever can manage stall access can manage them too.
  const showCashiers = canManageAccess(user);
  const showRegister = canManageAccess(user);
  const requestedSub = searchParams.get('sub') ?? 'money';
  // Tags used to be a sibling tab; it is now Money's Balances pane. An old link
  // lands where its content actually lives rather than on an empty tab.
  const normalisedSub = requestedSub === 'tags' ? 'money' : requestedSub;
  // Fall back to Money rather than render an empty pane when the URL names a
  // sub-tab this user can't see (shared link, or permissions changed).
  const sub =
    (normalisedSub === 'stalls' && !showStalls)
    || (normalisedSub === 'catalogue' && !showCatalogue)
    || (normalisedSub === 'cashiers' && !showCashiers)
    || (normalisedSub === 'register' && !showRegister)
      ? 'money'
      : normalisedSub;
  const setSub = (v: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('sub', v);
    next.delete('pane');
    setSearchParams(next, { replace: true });
  };

  const pane = requestedSub === 'tags' ? 'balances' : (searchParams.get('pane') ?? 'transactions');
  const setPane = (v: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('sub', 'money');
    next.set('pane', v);
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
      {/* Totals stay above the panes: they are the answer to "how did the night
          go", which every pane below is a breakdown of. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<CreditCard className="h-4 w-4" />} label="Circulated" value={fmtR(summary.circulated)} hint="loaded onto bands" tone="ink" />
        <StatCard icon={<ArrowUpCircle className="h-4 w-4" />} label="Spent" value={fmtR(summary.spent)} hint="at stalls" tone="blue" />
        <StatCard icon={<ArrowDownCircle className="h-4 w-4" />} label="Withdrawn" value={fmtR(summary.withdrawn)} hint="handed back" tone="orange" />
        <StatCard icon={<Wallet className="h-4 w-4" />} label="Left behind" value={fmtR(summary.leftBehind)} hint="still on bands" tone="green" />
      </div>

      <div className="text-sm text-muted-foreground">
        {summary.walletsFunded} wallet{summary.walletsFunded === 1 ? '' : 's'} funded · {fmtR(summary.fees)} platform fees collected
      </div>

      <Tabs value={pane} onValueChange={setPane} className="space-y-4">
        <TabsList>
          <TabsTrigger value="transactions">Transaction log</TabsTrigger>
          <TabsTrigger value="cashiers">Cashier activity</TabsTrigger>
          <TabsTrigger value="stalls">Stall takings</TabsTrigger>
          <TabsTrigger value="balances">Balances</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions">
          <EventTransactionLog eventId={eventId} />
        </TabsContent>

        <TabsContent value="cashiers">
          <CashierActivity summary={summary} onManage={showCashiers ? () => setSub('cashiers') : undefined} />
        </TabsContent>

        <TabsContent value="stalls">
          <StallTakings eventId={eventId} summary={summary} onManage={showStalls ? () => setSub('stalls') : undefined} />
        </TabsContent>

        <TabsContent value="balances">
          <EventTagsPanel eventId={eventId} />
        </TabsContent>
      </Tabs>
    </div>
  );

  return (
    <Tabs value={sub} onValueChange={setSub} className="space-y-4">
      <TabsList>
        <TabsTrigger value="money">Money</TabsTrigger>
        <TabsTrigger value="stock">Stock</TabsTrigger>
        {showRegister && <TabsTrigger value="register">Register</TabsTrigger>}
        {showStalls && <TabsTrigger value="stalls">Stalls</TabsTrigger>}
        {showCatalogue && <TabsTrigger value="catalogue">Catalogue</TabsTrigger>}
        {showCashiers && <TabsTrigger value="cashiers">Cashiers</TabsTrigger>}
      </TabsList>
      <TabsContent value="money">{moneyBody}</TabsContent>
      <TabsContent value="stock">
        <EventStockReport eventId={eventId} />
      </TabsContent>
      {showRegister && (
        <TabsContent value="register">
          <EventRegisterPanel eventId={eventId} />
        </TabsContent>
      )}
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

/** What each money-desk person moved, and how much of it. */
function CashierActivity({ summary, onManage }: { summary: CashlessSummary; onManage?: (() => void) | undefined }) {
  const navigate = useNavigate();
  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        {onManage && (
          <div className="flex justify-end">
            <button type="button" onClick={onManage}
              className="text-xs font-medium text-orange-600 hover:text-orange-700 inline-flex items-center gap-1">
              Manage cashiers <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
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
  );
}

/** What each stall took, and what it is owed after commission. */
function StallTakings({
  eventId, summary, onManage,
}: { eventId: string; summary: CashlessSummary; onManage?: (() => void) | undefined }) {
  const navigate = useNavigate();
  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        {onManage && (
          <div className="flex justify-end">
            <button type="button" onClick={onManage}
              className="text-xs font-medium text-orange-600 hover:text-orange-700 inline-flex items-center gap-1">
              Manage stalls <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
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
