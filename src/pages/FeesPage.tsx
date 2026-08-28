import { useState, Fragment } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Receipt, Ticket, Percent, Coins, ChevronRight, ChevronDown } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { paymentLabel } from '@/lib/payment';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatsCard } from '@/components/ui/stats-card';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { DateRangePicker, type DateRange } from '@/components/DateRangePicker';
import { formatMoney, type Currency } from '@/lib/currency';
import { TablePagination } from '@/components/TablePagination';

const PAGE_SIZE = 25;
const money = (v: number, currency: Currency = 'SZL') => formatMoney(v ?? 0, currency, { space: true, decimals: 2 });

// Mirrors the API's settlementCurrencyForMethod (src/utils/currency.util.ts on
// the API side): card is the only rail that settles off-display, in ZAR —
// everything else (MoMo, wallet, cash, DeltaPay) settles in SZL. Static and
// known client-side, so this needs no backend change.
const settlementCurrencyForMethod = (method: string): Currency =>
  method === 'peach_card' ? 'ZAR' : 'SZL';

export function FeesPage() {
  const [range, setRange] = useState<DateRange>({ startDate: undefined, endDate: undefined });
  const [eventId, setEventId] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Event picker options — all events (super admin sees every vendor's).
  const { data: eventsData } = useQuery({
    queryKey: ['fees-event-options'],
    queryFn: () => apiClient.events.getEvents({ limit: 500 }),
  });
  const eventOptions = [
    { value: '', label: 'All events' },
    ...(eventsData?.data ?? []).map((e) => ({ value: e._id, label: e.name })),
  ];

  const { data, isLoading } = useQuery({
    queryKey: ['fees', range.startDate, range.endDate, eventId, page],
    queryFn: () =>
      apiClient.fees.list({
        startDate: range.startDate,
        endDate: range.endDate,
        eventId: eventId || undefined,
        page,
        limit: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  const events = data?.events ?? [];
  const totals = data?.totals;
  const pagination = data?.pagination;

  // The KPI row is a cross-event aggregate by default (base E) — UNLESS the
  // event filter narrows it to one event, in which case it's that event's
  // money and should show that event's currency.
  const filterEvent = eventId ? eventsData?.data?.find((e) => e._id === eventId) : undefined;
  const statsCurrency: Currency = filterEvent?.currency ?? 'SZL';

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Fees</h1>
        <p className="text-sm text-slate-500">
          Booking charges Carrot has collected per event — buyer booking fee, booking fee an
          organizer chose to cover for their buyers, and platform commission.
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatsCard
          title="Total Carrot fees"
          value={isLoading && !data ? '—' : money(totals?.totalFees ?? 0, statsCurrency)}
          description="Booking + organizer-paid + commission"
          icon={Receipt}
          gradient="from-orange-500 to-orange-600"
        />
        <StatsCard
          title="Booking fees"
          value={isLoading && !data ? '—' : money(totals?.bookingFees ?? 0, statsCurrency)}
          description="Buyer-paid per-ticket fee (online)"
          icon={Coins}
          gradient="from-emerald-500 to-emerald-600"
        />
        <StatsCard
          title="Organizer-paid fees"
          value={isLoading && !data ? '—' : money(totals?.absorbedFees ?? 0, statsCurrency)}
          description="Same fee, billed to the organizer"
          icon={Coins}
          gradient="from-amber-500 to-amber-600"
        />
        <StatsCard
          title="Platform commission"
          value={isLoading && !data ? '—' : money(totals?.platformFees ?? 0, statsCurrency)}
          description="% of face, all channels"
          icon={Percent}
          gradient="from-indigo-500 to-indigo-600"
        />
        <StatsCard
          title="Tickets sold"
          value={isLoading && !data ? '—' : (totals?.ticketsSold ?? 0).toLocaleString()}
          description="Completed sales in range"
          icon={Ticket}
          gradient="from-slate-500 to-slate-600"
        />
      </div>

      {/* Fees table */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Fees by event</CardTitle>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="sm:w-56">
              <SearchableSelect
                value={eventId}
                onValueChange={(v) => { setEventId(v); setPage(1); }}
                options={eventOptions}
                placeholder="All events"
                searchPlaceholder="Search events…"
              />
            </div>
            <DateRangePicker value={range} onChange={(r) => { setRange(r); setPage(1); }} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Event</TableHead>
                  <TableHead className="text-right">Tickets</TableHead>
                  <TableHead className="text-right">Face value</TableHead>
                  <TableHead className="text-right">Booking fee</TableHead>
                  <TableHead className="text-right">Organizer-paid</TableHead>
                  <TableHead className="text-right">Platform commission</TableHead>
                  <TableHead className="text-right">Total fees</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && !data ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-slate-500 py-8">Loading…</TableCell>
                  </TableRow>
                ) : events.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-slate-500 py-8">
                      No fees collected for this filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  events.map((e) => (
                    <Fragment key={e.eventId}>
                      <TableRow className="cursor-pointer hover:bg-slate-50" onClick={() => toggle(e.eventId)}>
                        <TableCell className="text-slate-400">
                          {expanded.has(e.eventId) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </TableCell>
                        <TableCell className="font-medium">{e.eventName}</TableCell>
                        <TableCell className="text-right">{e.ticketsSold.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-slate-500">{money(e.faceValue, e.currency ?? 'SZL')}</TableCell>
                        <TableCell className="text-right">{money(e.bookingFees, e.currency ?? 'SZL')}</TableCell>
                        <TableCell className="text-right">{money(e.absorbedFees, e.currency ?? 'SZL')}</TableCell>
                        <TableCell className="text-right">{money(e.platformFees, e.currency ?? 'SZL')}</TableCell>
                        <TableCell className="text-right font-semibold">{money(e.totalFees, e.currency ?? 'SZL')}</TableCell>
                      </TableRow>
                      {expanded.has(e.eventId) && (
                        <TableRow className="bg-slate-50/60">
                          <TableCell />
                          <TableCell colSpan={7} className="py-2">
                            <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">By payment method</div>
                            <table className="w-full text-sm">
                              <tbody>
                                {e.byMethod.map((m) => {
                                  const eventCurrency = e.currency ?? 'SZL';
                                  const settlementCurrency = settlementCurrencyForMethod(m.method);
                                  const settledDifferently = settlementCurrency !== eventCurrency;
                                  return (
                                    <tr key={m.method} className="text-slate-600">
                                      <td className="py-1">{paymentLabel(m.method)}</td>
                                      <td className="py-1 text-right">{m.ticketsSold.toLocaleString()} tix</td>
                                      <td className="py-1 text-right">Booking {money(m.bookingFees, eventCurrency)}</td>
                                      <td className="py-1 text-right">Organizer {money(m.absorbedFees, eventCurrency)}</td>
                                      <td className="py-1 text-right">Commission {money(m.platformFees, eventCurrency)}</td>
                                      <td className="py-1 text-right font-medium">
                                        {money(m.totalFees, eventCurrency)}
                                        {settledDifferently && (
                                          <div className="text-xs font-normal text-slate-400">
                                            settled {money(m.totalFees, settlementCurrency)}
                                          </div>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <TablePagination
            page={pagination?.page ?? page}
            totalPages={pagination?.totalPages ?? 0}
            total={pagination?.total ?? 0}
            itemLabel="event"
            onPageChange={setPage}
            busy={isLoading}
          />
        </CardContent>
      </Card>
    </div>
  );
}
