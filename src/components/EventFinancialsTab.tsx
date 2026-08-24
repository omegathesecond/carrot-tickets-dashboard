import { useQuery } from '@tanstack/react-query';
import {
  Banknote,
  Wallet,
  TrendingUp,
  Ticket as TicketIcon,
  AlertTriangle,
  Store,
  Landmark,
  HandCoins,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { paymentLabel } from '@/lib/payment';
import { channelLabel } from '@/lib/channel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatsCard } from '@/components/ui/stats-card';
import { formatMoney, type Currency } from '@/lib/currency';
import type { EventFinancialsRow } from '@/types';

interface EventFinancialsTabProps {
  eventId: string;
}

/** Every figure on this tab is in the event's own currency, never the platform base. */
const money = (v: number, currency: Currency) => formatMoney(v ?? 0, currency, { space: true, decimals: 2 });

/** The money columns are identical for the method and channel tables — one
 *  renderer so the two can never disagree about what a column means. */
function MoneyCells({ row, currency }: { row: EventFinancialsRow; currency: Currency }) {
  return (
    <>
      <TableCell className="text-right">{row.sales.toLocaleString()}</TableCell>
      <TableCell className="text-right">{row.tickets.toLocaleString()}</TableCell>
      <TableCell className="text-right">{money(row.face, currency)}</TableCell>
      <TableCell className="text-right text-slate-500">
        {row.bookingFee > 0 ? money(row.bookingFee, currency) : '—'}
      </TableCell>
      <TableCell className="text-right">{money(row.charged, currency)}</TableCell>
      <TableCell className="text-right text-slate-500">
        {row.resellerCommission > 0 ? money(row.resellerCommission, currency) : '—'}
      </TableCell>
      <TableCell className="text-right font-medium">{money(row.organizerProceeds, currency)}</TableCell>
    </>
  );
}

function MoneyHeader({ firstColumn }: { firstColumn: string }) {
  return (
    <TableHeader>
      <TableRow>
        <TableHead>{firstColumn}</TableHead>
        <TableHead className="text-right">Sales</TableHead>
        <TableHead className="text-right">Tickets</TableHead>
        <TableHead className="text-right">Face value</TableHead>
        <TableHead className="text-right">Booking fee</TableHead>
        <TableHead className="text-right">Buyer paid</TableHead>
        <TableHead className="text-right">Reseller cut</TableHead>
        <TableHead className="text-right">Your proceeds</TableHead>
      </TableRow>
    </TableHeader>
  );
}

export function EventFinancialsTab({ eventId }: EventFinancialsTabProps) {
  const { data: fin, isLoading, error } = useQuery({
    queryKey: ['eventFinancials', eventId],
    queryFn: () => apiClient.analytics.getEventFinancials(eventId),
    enabled: !!eventId,
  });

  if (isLoading) {
    return <div className="p-8 text-center text-slate-500 animate-pulse">Loading financials…</div>;
  }

  // Surface the failure rather than rendering zeroes — an empty money table is
  // indistinguishable from "this event sold nothing".
  if (error || !fin) {
    return (
      <div className="p-8 text-center">
        <AlertTriangle className="h-8 w-8 mx-auto text-red-500 mb-3" />
        <p className="text-slate-900 font-medium">Couldn&apos;t load financials for this event</p>
        <p className="text-sm text-slate-600 mt-1">
          {(error as Error)?.message ?? 'The financials request failed.'}
        </p>
      </div>
    );
  }

  const c = fin.currency;
  const { totals, custody, paid, comps, failed } = fin;
  const heldElsewhere = custody.withResellersUnremitted + custody.withVendor;

  return (
    <div className="space-y-6">
      {/* The ladder: what tickets sold for, what buyers actually paid, what's left. */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatsCard
          title="Ticket face value"
          value={money(totals.face, c)}
          description={`${paid.tickets.toLocaleString()} paid tickets`}
          icon={TicketIcon}
          gradient="from-slate-500 to-slate-600"
        />
        <StatsCard
          title="Buyers paid"
          value={money(totals.charged, c)}
          description={
            totals.bookingFees > 0
              ? `Incl. ${money(totals.bookingFees, c)} booking fees`
              : 'No booking fees charged'
          }
          icon={Banknote}
          gradient="from-blue-500 to-blue-600"
        />
        <StatsCard
          title="Your proceeds"
          value={money(totals.organizerProceeds, c)}
          description="After commission and fees"
          icon={TrendingUp}
          gradient="from-emerald-500 to-emerald-600"
        />
        <StatsCard
          title="Available to pay out"
          value={money(custody.availableNow, c)}
          description={
            heldElsewhere > 0 ? `${money(heldElsewhere, c)} still held elsewhere` : 'All proceeds collected'
          }
          icon={Wallet}
          gradient="from-orange-500 to-amber-600"
        />
      </div>

      {/* Where the money physically is. On a reseller-heavy event this is the
          difference between what was earned and what can actually be paid. */}
      <Card>
        <CardHeader>
          <CardTitle>Where the money is</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Landmark className="h-4 w-4" /> Held by Carrot
              </div>
              <div className="text-xl font-bold text-slate-900 mt-1">{money(custody.withCarrot, c)}</div>
              <p className="text-xs text-slate-500 mt-1">Online sales — payable to you</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Store className="h-4 w-4" /> With resellers
              </div>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {money(custody.withResellersUnremitted, c)}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {custody.withResellersRemitted > 0
                  ? `Cash not yet handed in · ${money(custody.withResellersRemitted, c)} already remitted`
                  : 'Cash not yet handed in'}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <HandCoins className="h-4 w-4" /> With you
              </div>
              <div className="text-xl font-bold text-slate-900 mt-1">{money(custody.withVendor, c)}</div>
              <p className="text-xs text-slate-500 mt-1">Cash you took at the gate</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* The headline ask: how much came in on each payment method. */}
      <Card>
        <CardHeader>
          <CardTitle>By payment method</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <MoneyHeader firstColumn="Method" />
              <TableBody>
                {fin.byMethod.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-slate-500 py-8">
                      No completed sales yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  fin.byMethod.map((m) => (
                    <TableRow key={m.method}>
                      <TableCell className="font-medium">{paymentLabel(m.method)}</TableCell>
                      <MoneyCells row={m} currency={c} />
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>By sales channel</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <MoneyHeader firstColumn="Channel" />
              <TableBody>
                {fin.byChannel.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-slate-500 py-8">
                      No completed sales yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  fin.byChannel.map((ch) => (
                    <TableRow key={ch.channel}>
                      <TableCell className="font-medium">{channelLabel(ch.channel)}</TableCell>
                      <MoneyCells row={ch} currency={c} />
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Paid vs free. Averaging free entries into paid revenue is what made
            the old "average ticket price" read an order of magnitude low. */}
        <Card>
          <CardHeader>
            <CardTitle>Tickets issued</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-slate-600">Paid tickets</span>
              <span className="font-semibold text-slate-900">{paid.tickets.toLocaleString()}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-slate-600">Free entries (wristbands, free tiers)</span>
              <span className="font-semibold text-slate-900">{comps.tickets.toLocaleString()}</span>
            </div>
            <div className="flex items-baseline justify-between border-t border-slate-200 pt-3">
              <span className="text-sm text-slate-600">Average paid ticket</span>
              <span className="font-semibold text-slate-900">{money(paid.averageTicketPrice, c)}</span>
            </div>
            {comps.tickets > 0 && (
              <p className="text-xs text-slate-500">
                Free entries are excluded from the average — including them would understate what a
                ticket actually sells for.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Attempted revenue that never landed. On a busy event this is often
            the single largest recoverable number on the page. */}
        <Card>
          <CardHeader>
            <CardTitle>Failed payments</CardTitle>
          </CardHeader>
          <CardContent>
            {failed.sales === 0 ? (
              <p className="text-sm text-slate-600">Every payment attempt on this event completed.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-slate-600">Attempts that failed</span>
                  <span className="font-semibold text-slate-900">{failed.sales.toLocaleString()}</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-slate-600">Tickets not issued</span>
                  <span className="font-semibold text-slate-900">{failed.tickets.toLocaleString()}</span>
                </div>
                <div className="flex items-baseline justify-between border-t border-slate-200 pt-3">
                  <span className="text-sm text-slate-600">Face value not collected</span>
                  <span className="font-semibold text-red-600">{money(failed.face, c)}</span>
                </div>
                <p className="text-xs text-slate-500">
                  Buyers who started a payment that didn&apos;t go through. Not money you are owed —
                  money the event didn&apos;t manage to take.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {totals.carrotEarned > 0 && (
        <p className="text-xs text-slate-500">
          Carrot earned {money(totals.carrotEarned, c)} on this event in booking fees and commission.
        </p>
      )}
    </div>
  );
}
