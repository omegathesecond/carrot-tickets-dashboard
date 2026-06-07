import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { DateRangePicker, DateRange } from '@/components/DateRangePicker';
import { Download } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/chartColors';
import type { SalesQueryParams } from '@/types';

const ALL = 'all';

export function SalesHistoryPage() {
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: undefined,
    endDate: undefined,
    preset: 'all',
  });
  const [eventId, setEventId] = useState<string>(ALL);
  const [paymentMethod, setPaymentMethod] = useState<string>(ALL);
  const [paymentStatus, setPaymentStatus] = useState<string>(ALL);

  // Build the filter params shared by the sales list, the analytics row and the
  // CSV export so all three stay in sync.
  const filterParams: SalesQueryParams = {
    limit: 100,
    ...(dateRange.startDate ? { startDate: dateRange.startDate } : {}),
    ...(dateRange.endDate ? { endDate: dateRange.endDate } : {}),
    ...(eventId !== ALL ? { eventId } : {}),
    ...(paymentMethod !== ALL ? { paymentMethod: paymentMethod as SalesQueryParams['paymentMethod'] } : {}),
    ...(paymentStatus !== ALL ? { paymentStatus: paymentStatus as SalesQueryParams['paymentStatus'] } : {}),
  };

  const { data: salesData, isLoading } = useQuery({
    queryKey: ['sales', filterParams],
    queryFn: () => apiClient.sales.getSales(filterParams),
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

  const statsCards = [
    { title: 'Total Sales', value: (stats?.totalSales || 0).toLocaleString() },
    { title: 'Total Revenue', value: formatCurrency(stats?.totalRevenue || 0) },
    { title: 'Refunds', value: (stats?.totalRefunds || 0).toLocaleString() },
    { title: 'Avg. Sale', value: formatCurrency(stats?.averageSaleAmount || 0) },
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <DateRangePicker value={dateRange} onChange={setDateRange} />
            </div>
            <div className="space-y-2">
              <Label>Event</Label>
              <SearchableSelect
                value={eventId}
                onValueChange={setEventId}
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
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="keshless_wallet">Wallet</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={paymentStatus} onValueChange={setPaymentStatus}>
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
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Sales</CardTitle>
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
                      <TableCell className="font-medium">E {sale.totalAmount.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={sale.paymentMethod === 'cash' ? 'secondary' : 'default'}>
                          {sale.paymentMethod === 'cash' ? 'Cash' : 'Wallet'}
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
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-slate-500 py-8">
                      No sales found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
