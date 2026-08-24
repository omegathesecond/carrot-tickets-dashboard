import { useState } from 'react';
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
  HelpCircle,
  ChevronRight,
  ChevronDown,
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

/**
 * Plain-English definitions for every figure on this tab.
 *
 * These exist because the column names come from the data model, where a
 * "sale" is one transaction row — but to anyone reading a financial report
 * "sales" means revenue. Rather than leave the reader to guess which columns
 * are counts and which are money, each one says so outright.
 */
const GLOSSARY: { term: string; blurb: string; feesOnly?: boolean }[] = [
  {
    term: 'Payments',
    blurb:
      'How many separate times money changed hands — a count, not an amount. One payment can cover several tickets, so this is always lower than the ticket count.',
  },
  {
    term: 'Tickets',
    blurb:
      'How many tickets those payments produced. A single wristband batch counts as one payment but can issue hundreds of tickets, which is why the two numbers can differ enormously.',
  },
  {
    term: 'Face value',
    blurb: 'The ticket price itself, added up. This is the number your ticket prices are set to.',
  },
  {
    term: 'Booking fee',
    feesOnly: true,
    blurb:
      'A flat fee Carrot adds on top at online checkout. It is paid by the buyer, not taken out of your money — which is why it only ever appears on online rows, never on cash or gate sales.',
  },
  {
    term: 'Buyer paid',
    feesOnly: true,
    blurb:
      'Face value plus the booking fee — what actually left the buyer\'s pocket. On cash and reseller rows there is no booking fee, so this matches face value exactly.',
  },
  {
    term: 'Reseller cut',
    blurb: 'Commission earned by a reseller on tickets they sold. Deducted from your proceeds.',
  },
  {
    term: 'Your proceeds',
    blurb: 'What you keep: face value less any reseller commission and platform commission.',
  },
  {
    term: 'Available to pay out',
    blurb:
      'Proceeds Carrot is actually holding and can transfer to you now. Cash a reseller has taken but not yet handed in is money you are owed, but it cannot be paid out until they remit it — so it is deliberately excluded here.',
  },
  {
    term: 'Free entries',
    blurb:
      'Tickets issued at no charge — wristband batches and any zero-priced ticket type. They are counted separately so they cannot drag down the average paid ticket price.',
  },
];

/** Every figure on this tab is in the event's own currency, never the platform base. */
const money = (v: number, currency: Currency) => formatMoney(v ?? 0, currency, { space: true, decimals: 2 });

/** The money columns are identical for the method and channel tables — one
 *  renderer so the two can never disagree about what a column means.
 *
 *  `showFees` mirrors what the API actually sent rather than re-deriving the
 *  permission client-side, so the two can't drift apart. */
function MoneyCells({
  row,
  currency,
  showFees,
}: {
  row: EventFinancialsRow;
  currency: Currency;
  showFees: boolean;
}) {
  return (
    <>
      <TableCell className="text-right">{row.sales.toLocaleString()}</TableCell>
      <TableCell className="text-right">{row.tickets.toLocaleString()}</TableCell>
      <TableCell className="text-right">{money(row.face, currency)}</TableCell>
      {showFees && (
        <>
          <TableCell className="text-right text-slate-500">
            {(row.bookingFee ?? 0) > 0 ? money(row.bookingFee ?? 0, currency) : '—'}
          </TableCell>
          <TableCell className="text-right">{money(row.charged ?? 0, currency)}</TableCell>
        </>
      )}
      <TableCell className="text-right text-slate-500">
        {row.resellerCommission > 0 ? money(row.resellerCommission, currency) : '—'}
      </TableCell>
      <TableCell className="text-right font-medium">{money(row.organizerProceeds, currency)}</TableCell>
    </>
  );
}

function MoneyHeader({ firstColumn, showFees }: { firstColumn: string; showFees: boolean }) {
  return (
    <TableHeader>
      <TableRow>
        <TableHead>{firstColumn}</TableHead>
        {/* "Payments", not "Sales" — this is a COUNT of transactions, and in a
            table of currency columns "Sales" reads as revenue. */}
        <TableHead className="text-right">Payments</TableHead>
        <TableHead className="text-right">Tickets</TableHead>
        <TableHead className="text-right">Face value</TableHead>
        {showFees && (
          <>
            <TableHead className="text-right">Booking fee</TableHead>
            <TableHead className="text-right">Buyer paid</TableHead>
          </>
        )}
        <TableHead className="text-right">Reseller cut</TableHead>
        <TableHead className="text-right">Your proceeds</TableHead>
      </TableRow>
    </TableHeader>
  );
}

export function EventFinancialsTab({ eventId }: EventFinancialsTabProps) {
  const [glossaryOpen, setGlossaryOpen] = useState(false);
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
  // Fee data is present only for super-admins — the API withholds it from
  // organizers, so its presence IS the permission signal.
  const showFees = fin.totals.bookingFees !== undefined;
  // `fin.failed` is deliberately not read — the endpoint still reports failed
  // payment attempts, but this tab is about money that actually moved.
  const { totals, custody, paid, comps } = fin;
  const heldElsewhere = custody.withResellersUnremitted + custody.withVendor;

  return (
    <div className="space-y-6">
      {/* The ladder: what tickets sold for, what buyers actually paid, what's left. */}
      <div className={`grid grid-cols-1 gap-4 ${showFees ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
        <StatsCard
          title="Ticket face value"
          value={money(totals.face, c)}
          description={`${paid.tickets.toLocaleString()} paid tickets`}
          icon={TicketIcon}
          gradient="from-slate-500 to-slate-600"
        />
        {showFees && (
          <StatsCard
            title="Buyers paid"
            value={money(totals.charged ?? 0, c)}
            description={
              (totals.bookingFees ?? 0) > 0
                ? `Incl. ${money(totals.bookingFees ?? 0, c)} booking fees`
                : 'No booking fees charged'
            }
            icon={Banknote}
            gradient="from-blue-500 to-blue-600"
          />
        )}
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
              <MoneyHeader firstColumn="Method" showFees={showFees} />
              <TableBody>
                {fin.byMethod.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={showFees ? 8 : 6} className="text-center text-slate-500 py-8">
                      No completed sales yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  fin.byMethod.map((m) => (
                    <TableRow key={m.method}>
                      <TableCell className="font-medium">{paymentLabel(m.method)}</TableCell>
                      <MoneyCells row={m} currency={c} showFees={showFees} />
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
              <MoneyHeader firstColumn="Channel" showFees={showFees} />
              <TableBody>
                {fin.byChannel.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={showFees ? 8 : 6} className="text-center text-slate-500 py-8">
                      No completed sales yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  fin.byChannel.map((ch) => (
                    <TableRow key={ch.channel}>
                      <TableCell className="font-medium">{channelLabel(ch.channel)}</TableCell>
                      <MoneyCells row={ch} currency={c} showFees={showFees} />
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

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

      {/* Collapsed by default — an organizer who already knows the terms
          shouldn't have to scroll past a wall of definitions every visit. */}
      <Card>
        <button
          type="button"
          onClick={() => setGlossaryOpen((open) => !open)}
          aria-expanded={glossaryOpen}
          className="w-full flex items-center justify-between p-6 text-left hover:bg-slate-50 rounded-lg transition-colors"
        >
          <span className="flex items-center gap-2 font-semibold text-slate-900">
            <HelpCircle className="h-4 w-4 text-slate-500" />
            What these numbers mean
          </span>
          {glossaryOpen ? (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-400" />
          )}
        </button>
        {glossaryOpen && (
          <CardContent className="pt-0">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
              {GLOSSARY.filter((g) => showFees || !g.feesOnly).map((g) => (
                <div key={g.term}>
                  <dt className="text-sm font-semibold text-slate-900">{g.term}</dt>
                  <dd className="text-sm text-slate-600 mt-0.5">{g.blurb}</dd>
                </div>
              ))}
            </dl>
            {showFees && (totals.carrotEarned ?? 0) > 0 && (
              <p className="text-xs text-slate-500 mt-6 border-t border-slate-200 pt-4">
                Carrot earned {money(totals.carrotEarned ?? 0, c)} on this event in booking fees and
                commission.
              </p>
            )}
          </CardContent>
        )}
      </Card>

      {!glossaryOpen && showFees && (totals.carrotEarned ?? 0) > 0 && (
        <p className="text-xs text-slate-500">
          Carrot earned {money(totals.carrotEarned ?? 0, c)} on this event in booking fees and commission.
        </p>
      )}
    </div>
  );
}
