import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { DateRangePicker, DateRange } from '@/components/DateRangePicker';
import { TablePagination } from '@/components/TablePagination';
import { Download } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/chartColors';
import { channelLabel, channelSource } from '@/lib/channel';
import { paymentLabel } from '@/lib/payment';
import { formatMoney } from '@/lib/currency';
import type { SalesQueryParams } from '@/types';

const ALL = 'all';

// Matches UsersPage / OrganizersPage / FeesPage. The API caps `limit` at 100
// (ticketSalesQuerySchema), which is why 100 is the largest option offered —
// and why the old hardcoded `limit: 100` made sale #101 unreachable.
const DEFAULT_PAGE_SIZE = 25;
const PAGE_SIZE_OPTIONS = [25, 50, 100];

export function SalesHistoryPage() {
  // The API only ever returns completed sales to organizers — failed/pending
  // payment attempts are visible to Carrot super-admins only — so the payment
  // status filter is meaningless (and misleading) for everyone else.
  const { user } = useAuth();
  const canFilterPaymentStatus = Boolean(user?.isSuperAdmin);
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: undefined,
    endDate: undefined,
    preset: 'all',
  });
  const [eventId, setEventId] = useState<string>(ALL);
  const [paymentMethod, setPaymentMethod] = useState<string>(ALL);
  const [paymentStatus, setPaymentStatus] = useState<string>(ALL);
  const [channel, setChannel] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  /**
   * Wraps a filter setter so changing it also returns to page 1. Without this,
   * narrowing from 400 unfiltered sales (while on page 9) to a single event
   * with 30 sales leaves `page` at 9 — and the API dutifully returns an empty
   * slice, which the table renders as "No sales found". FeesPage does the same
   * thing inline; this keeps it honest across all five filters.
   */
  function onFilterChange<T>(set: (value: T) => void) {
    return (value: T) => {
      set(value);
      setPage(1);
    };
  }

  // Build the filter params shared by the sales list, the analytics row and the
  // CSV export so all three stay in sync. Paging is deliberately NOT in here:
  // the CSV export is a whole-result-set download, not the visible page.
  const filterParams: SalesQueryParams = {
    ...(dateRange.startDate ? { startDate: dateRange.startDate } : {}),
    ...(dateRange.endDate ? { endDate: dateRange.endDate } : {}),
    ...(eventId !== ALL ? { eventId } : {}),
    ...(paymentMethod !== ALL ? { paymentMethod: paymentMethod as SalesQueryParams['paymentMethod'] } : {}),
    ...(canFilterPaymentStatus && paymentStatus !== ALL
      ? { paymentStatus: paymentStatus as SalesQueryParams['paymentStatus'] }
      : {}),
    ...(channel !== ALL ? { channel: channel as SalesQueryParams['channel'] } : {}),
  };

  const listParams: SalesQueryParams = { ...filterParams, page, limit: pageSize };

  const { data: salesData, isLoading, isFetching } = useQuery({
    queryKey: ['sales', listParams],
    // Hold the previous page's rows while the next one loads, so stepping
    // through pages doesn't flash the table empty between fetches.
    placeholderData: keepPreviousData,
    queryFn: () => apiClient.sales.getSales(listParams),
  });

  const { data: stats } = useQuery({
    queryKey: ['salesStats', eventId, dateRange.startDate, dateRange.endDate],
    queryFn: () => apiClient.analytics.getSalesStats({
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      ...(eventId !== ALL ? { eventId } : {}),
    }),
  });

  const { data: eventsData } = useQuery({
    queryKey: ['events', 'all-for-filter'],
    queryFn: () => apiClient.events.getEvents({ limit: 100 }),
  });

  const handleExport = () => {
    apiClient.exports.exportSalesCSV(filterParams);
  };

  // The analytics row is a cross-event aggregate by default (base E) — UNLESS
  // the event filter narrows it to one event, in which case it genuinely is
  // that event's money and should show that event's currency.
  const filterEvent = eventId !== ALL ? eventsData?.data?.find((e) => e._id === eventId) : undefined;
  const statsCurrency = filterEvent?.currency ?? 'SZL';

  const statsCards = [
    { title: 'Total Sales', value: (stats?.totalSales || 0).toLocaleString() },
    { title: 'Total Revenue', value: formatCurrency(stats?.totalRevenue || 0, statsCurrency) },
    { title: 'Refunds', value: (stats?.totalRefunds || 0).toLocaleString() },
    { title: 'Avg. Sale', value: formatCurrency(stats?.averageSaleAmount || 0, statsCurrency) },
  ];

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sales History</h1>
          <p className="text-slate-600">View all ticket sales</p>
        </div>
        <Button onClick={handleExport} variant="outline">
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
      </div>

      {/* Analytics row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((s) => (
          <Card key={s.title}>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-slate-900">{s.value}</div>
              <div className="text-sm text-slate-600">{s.title}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters: date, event, payment type, status */}
      <Card>
        <CardContent className="pt-6">
          <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${canFilterPaymentStatus ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
            <div className="space-y-2">
              <Label>Date</Label>
              <DateRangePicker value={dateRange} onChange={onFilterChange(setDateRange)} />
            </div>
            <div className="space-y-2">
              <Label>Event</Label>
              <SearchableSelect
                value={eventId}
                onValueChange={onFilterChange(setEventId)}
                options={[
                  { value: ALL, label: 'All events' },
                  ...(eventsData?.data || []).map((e) => ({ value: e._id, label: e.name })),
                ]}
                placeholder="All events"
                searchPlaceholder="Search events…"
                emptyText="No events found"
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Type</Label>
              <Select value={paymentMethod} onValueChange={onFilterChange(setPaymentMethod)}>
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="keshless_wallet">Wallet</SelectItem>
                  <SelectItem value="mtn_momo">MoMo</SelectItem>
                  <SelectItem value="peach_card">Card</SelectItem>
                  <SelectItem value="deltapay">DeltaPay</SelectItem>
                  <SelectItem value="yoco">Card (Yoco)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {canFilterPaymentStatus && (
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={paymentStatus} onValueChange={onFilterChange(setPaymentStatus)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="refunded">Refunded</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Channel</Label>
              <Select value={channel} onValueChange={onFilterChange(setChannel)}>
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="box_office">Organizer</SelectItem>
                  <SelectItem value="reseller_pos">Reseller POS</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sales</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center text-slate-500">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Where Bought</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salesData?.data && salesData.data.length > 0 ? (
                  salesData.data.map((sale) => (
                    <TableRow key={sale._id}>
                      <TableCell>{format(new Date(sale.createdAt), 'PPp')}</TableCell>
                      <TableCell>
                        <div className="font-medium">{sale.customerName}</div>
                        <div className="text-sm text-slate-600">{sale.customerPhone}</div>
                      </TableCell>
                      <TableCell>{sale.event?.name || 'N/A'}</TableCell>
                      <TableCell>{sale.quantity}</TableCell>
                      <TableCell className="font-medium">
                        {formatMoney(sale.totalAmount, sale.currency ?? sale.event?.currency ?? 'SZL', { space: true, decimals: 0 })}
                        {sale.settlementCurrency && sale.settlementCurrency !== (sale.currency ?? sale.event?.currency ?? 'SZL') && (
                          <div className="text-xs font-normal text-slate-500">
                            settled {formatMoney(sale.amountCharged ?? sale.totalAmount, sale.settlementCurrency, { space: true, decimals: 0 })}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={sale.paymentMethod === 'cash' ? 'secondary' : 'default'}>
                          {paymentLabel(sale.paymentMethod)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            sale.paymentStatus === 'completed' || sale.paymentStatus === 'paid'
                              ? 'default'
                              : 'destructive'
                          }
                        >
                          {sale.paymentStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{channelLabel(sale.channel)}</Badge>
                        {channelSource(sale) && (
                          <div className="text-xs text-slate-500">{channelSource(sale)}</div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-slate-500 py-8">
                      No sales found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}

          {/* `pages`, not `totalPages` — getSales returns PaginatedResponse<T>,
              whose pagination field is named differently from the Users /
              Organizers / Fees responses. Mapping it here is exactly why
              TablePagination takes primitives. */}
          <TablePagination
            page={salesData?.pagination.page ?? page}
            totalPages={salesData?.pagination.pages ?? 0}
            total={salesData?.pagination.total ?? 0}
            itemLabel="sale"
            onPageChange={setPage}
            busy={isFetching}
            pageSize={pageSize}
            onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
          />
        </CardContent>
      </Card>
    </div>
  );
}
