import { useState, type ReactNode } from 'react';
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
import { EventStallsPanel } from '@/components/cashless/EventStallsPanel';
import { EventTagsPanel } from '@/components/cashless/EventTagsPanel';
import { EventCataloguePanel } from '@/components/cashless/EventCataloguePanel';
import { EventRegisterPanel } from '@/components/cashless/EventRegisterPanel';
import { EventTransactionLog } from '@/components/cashless/EventTransactionLog';
import { StatCard } from '@/components/cashless/StatCard';
import { CashiersPanel } from '@/components/CashiersPanel';
import { useAuth } from '@/contexts/AuthContext';
import { canManageAccess, canManageStock } from '@/lib/permissions';

/** Cashless wallet amounts move in ZAR cents on the wire. */
const fmtR = (cents: number) => `R${((cents ?? 0) / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Props {
  eventId: string;
}

/**
 * Everything cashless for ONE event. Money is the organizer's transaction
 * report; Register, Stalls, Catalogue, Cashiers and Balances each manage the
 * people, products and tags behind it, and each carries its own breakdown
 * (activity, takings, stock) as a nested tab rather than dumping every
 * breakdown under Money regardless of which desk it is actually about.
 * Stalls, products and stock are all eventId-bound in the model, so they live
 * here rather than on a top-level page that asks which event you meant.
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
  const [stallsView, setStallsView] = useState('takings');
  const [cashiersView, setCashiersView] = useState('activity');

  const showStalls = canManageAccess(user);
  const showCatalogue = canManageStock(user);
  // Same gate as Stalls: cashiers and the register desk are the organizer's own
  // in-venue staff, so whoever can manage stall access can manage them too.
  const showCashiers = canManageAccess(user);
  const showRegister = canManageAccess(user);
  const requestedSub = searchParams.get('sub') ?? 'money';
  // Tags/Balances used to live inside Money; Balances is now its own tab, so
  // both old shapes of the link land there rather than on an empty pane.
  const normalisedSub = requestedSub === 'tags' || requestedSub === 'balances' ? 'balances' : requestedSub;
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
    // Belongs to the sub-tab you are leaving (Catalogue's own levels/catalogue/
    // stock toggle) — carrying it over would deep-link the next visit to a
    // view of a tab it was never set for.
    next.delete('view');
    setSearchParams(next, { replace: true });
  };

  const summaryBody = (ready: (s: CashlessSummary) => ReactNode) => (
    isLoading ? (
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
    ) : ready(summary)
  );

  const moneyBody = summaryBody((s) => (
    <div className="space-y-6">
      {/* Totals stay above the log: they are the answer to "how did the night
          go", which the log below is a breakdown of. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<CreditCard className="h-4 w-4" />} label="Circulated" value={fmtR(s.circulated)} hint="loaded onto bands" tone="ink" />
        <StatCard icon={<ArrowUpCircle className="h-4 w-4" />} label="Spent" value={fmtR(s.spent)} hint="at stalls" tone="blue" />
        <StatCard icon={<ArrowDownCircle className="h-4 w-4" />} label="Withdrawn" value={fmtR(s.withdrawn)} hint="handed back" tone="orange" />
        <StatCard icon={<Wallet className="h-4 w-4" />} label="Left behind" value={fmtR(s.leftBehind)} hint="still on bands" tone="green" />
      </div>

      <div className="text-sm text-muted-foreground">
        {s.walletsFunded} wallet{s.walletsFunded === 1 ? '' : 's'} funded · {fmtR(s.fees)} platform fees collected
      </div>

      <EventTransactionLog eventId={eventId} />
    </div>
  ));

  const stallsBody = (
    <Tabs value={stallsView} onValueChange={setStallsView} className="space-y-4">
      <TabsList>
        <TabsTrigger value="takings">Stall takings</TabsTrigger>
        <TabsTrigger value="manage">Add stall</TabsTrigger>
      </TabsList>
      <TabsContent value="takings">
        {summaryBody((s) => (
          <StallTakings eventId={eventId} summary={s} onManage={() => setStallsView('manage')} />
        ))}
      </TabsContent>
      <TabsContent value="manage">
        <EventStallsPanel eventId={eventId} />
      </TabsContent>
    </Tabs>
  );

  const cashiersBody = (
    <Tabs value={cashiersView} onValueChange={setCashiersView} className="space-y-4">
      <TabsList>
        <TabsTrigger value="activity">Cashier activity</TabsTrigger>
        <TabsTrigger value="manage">Add cashier</TabsTrigger>
      </TabsList>
      <TabsContent value="activity">
        {summaryBody((s) => <CashierActivity summary={s} onManage={() => setCashiersView('manage')} />)}
      </TabsContent>
      <TabsContent value="manage">
        <CashiersPanel eventId={eventId} />
      </TabsContent>
    </Tabs>
  );

  return (
    <Tabs value={sub} onValueChange={setSub} className="space-y-4">
      <TabsList>
        <TabsTrigger value="money">Money</TabsTrigger>
        {showRegister && <TabsTrigger value="register">Register</TabsTrigger>}
        {showStalls && <TabsTrigger value="stalls">Stalls</TabsTrigger>}
        {showCatalogue && <TabsTrigger value="catalogue">Catalogue</TabsTrigger>}
        {showCashiers && <TabsTrigger value="cashiers">Cashiers</TabsTrigger>}
        <TabsTrigger value="balances">Balances</TabsTrigger>
      </TabsList>
      <TabsContent value="money">{moneyBody}</TabsContent>
      {showRegister && (
        <TabsContent value="register">
          <EventRegisterPanel eventId={eventId} />
        </TabsContent>
      )}
      {showStalls && <TabsContent value="stalls">{stallsBody}</TabsContent>}
      {showCatalogue && (
        <TabsContent value="catalogue">
          <EventCataloguePanel eventId={eventId} />
        </TabsContent>
      )}
      {showCashiers && <TabsContent value="cashiers">{cashiersBody}</TabsContent>}
      <TabsContent value="balances">
        <EventTagsPanel eventId={eventId} />
      </TabsContent>
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
