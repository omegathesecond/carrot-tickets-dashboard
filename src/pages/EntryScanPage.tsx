import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { DateRangePicker, DateRange } from '@/components/DateRangePicker';
import { ScanLine, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import type { ScanQueryParams } from '@/types';

const ALL = 'all';

// Defensive readers: the scans endpoint populates the event into `eventId` and
// the ticket into `ticketId`, and exposes a normalized `status`. Fall back
// gracefully across shapes so the table renders regardless of populate state.
const scanEventName = (s: any): string => s.event?.name || s.eventId?.name || 'N/A';
const scanTicketCode = (s: any): string => {
  if (s.ticketId && typeof s.ticketId === 'object') return s.ticketId.ticketId || '—';
  return s.ticket?.ticketId || '—';
};
const scanStatus = (s: any): 'success' | 'failed' =>
  s.status || (s.scanResult === 'success' ? 'success' : 'failed');
const scanTime = (s: any): string => format(new Date(s.scannedAt || s.createdAt), 'HH:mm:ss');

export function EntryScanPage() {
  const [ticketId, setTicketId] = useState('');
  const [lastScan, setLastScan] = useState<any>(null);
  const [eventId, setEventId] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: undefined,
    endDate: undefined,
    preset: 'all',
  });
  const queryClient = useQueryClient();

  const scanFilters: ScanQueryParams = {
    limit: 50,
    ...(eventId !== ALL ? { eventId } : {}),
    ...(status !== ALL ? { status: status as ScanQueryParams['status'] } : {}),
    ...(dateRange.startDate ? { startDate: dateRange.startDate } : {}),
    ...(dateRange.endDate ? { endDate: dateRange.endDate } : {}),
  };

  const { data: scansData } = useQuery({
    queryKey: ['scans', scanFilters],
    queryFn: () => apiClient.scans.getScans(scanFilters),
  });

  const { data: scanStats } = useQuery({
    queryKey: ['scanStats', eventId, dateRange.startDate, dateRange.endDate],
    queryFn: () => apiClient.scans.getScanStats({
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      ...(eventId !== ALL ? { eventId } : {}),
    }),
  });

  const { data: eventsData } = useQuery({
    queryKey: ['events', 'all-for-filter'],
    queryFn: () => apiClient.events.getEvents({ limit: 100 }),
  });

  const refetchScans = () => {
    queryClient.invalidateQueries({ queryKey: ['scans'] });
    queryClient.invalidateQueries({ queryKey: ['scanStats'] });
  };

  const validateMutation = useMutation({
    mutationFn: (ticketId: string) => apiClient.scans.validateTicket({ ticketId }),
    onSuccess: (data) => {
      setLastScan({ status: 'success', data });
      toast.success(data.message);
    },
    onError: (error: any) => {
      setLastScan({ status: 'failed', error: error.message });
      toast.error(error.message);
    },
  });

  const checkInMutation = useMutation({
    mutationFn: (ticketId: string) => apiClient.scans.checkIn({ ticketId }),
    onSuccess: () => {
      toast.success('Check-in successful!');
      setTicketId('');
      setLastScan(null);
      refetchScans();
    },
  });

  const handleValidate = (e: React.FormEvent) => {
    e.preventDefault();
    if (ticketId) {
      validateMutation.mutate(ticketId);
    }
  };

  const handleCheckIn = () => {
    if (ticketId) {
      checkInMutation.mutate(ticketId);
    }
  };

  const statsCards = [
    { title: 'Total Scans', value: (scanStats?.totalScans || 0).toLocaleString() },
    { title: 'Successful', value: (scanStats?.successfulScans || 0).toLocaleString() },
    { title: 'Failed', value: (scanStats?.failedScans || 0).toLocaleString() },
    { title: 'Already Scanned', value: (scanStats?.alreadyScannedCount || 0).toLocaleString() },
  ];

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Entry Scan</h1>
        <p className="text-slate-600">Validate and check-in tickets</p>
      </div>

      {/* Scan analytics */}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <ScanLine className="h-5 w-5 mr-2" /> Scan Ticket
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleValidate} className="space-y-4">
              <div className="space-y-2">
                <Label>Ticket ID / QR Code</Label>
                <Input
                  placeholder="Enter or scan ticket ID"
                  value={ticketId}
                  onChange={(e) => setTicketId(e.target.value)}
                  autoFocus
                />
              </div>
              <Button type="submit" className="w-full" disabled={validateMutation.isPending}>
                {validateMutation.isPending ? 'Validating...' : 'Validate Ticket'}
              </Button>
            </form>

            {lastScan && (
              <div className={`p-4 rounded-lg ${lastScan.status === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <div className="flex items-center mb-2">
                  {lastScan.status === 'success' ? (
                    <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600 mr-2" />
                  )}
                  <span className={`font-bold ${lastScan.status === 'success' ? 'text-green-900' : 'text-red-900'}`}>
                    {lastScan.status === 'success' ? 'Valid Ticket' : 'Invalid Ticket'}
                  </span>
                </div>
                {lastScan.status === 'success' ? (
                  <div className="space-y-2 text-sm">
                    <div><strong>Event:</strong> {lastScan.data?.event?.name}</div>
                    <div><strong>Type:</strong> {lastScan.data?.ticketType?.name}</div>
                    <Button onClick={handleCheckIn} className="w-full mt-4" disabled={checkInMutation.isPending}>
                      {checkInMutation.isPending ? 'Checking in...' : 'Check In'}
                    </Button>
                  </div>
                ) : (
                  <div className="text-sm text-red-700">{lastScan.error}</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Scans</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filters: event, date, status */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All statuses</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="already_scanned">Already Scanned</SelectItem>
                </SelectContent>
              </Select>
              <DateRangePicker value={dateRange} onChange={setDateRange} />
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Ticket ID</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scansData?.data && scansData.data.length > 0 ? (
                  scansData.data.map((scan: any) => (
                    <TableRow key={scan._id}>
                      <TableCell className="text-sm">{scanTime(scan)}</TableCell>
                      <TableCell className="font-mono text-xs">{scanTicketCode(scan)}</TableCell>
                      <TableCell>{scanEventName(scan)}</TableCell>
                      <TableCell>
                        <Badge variant={scanStatus(scan) === 'success' ? 'default' : 'destructive'}>
                          {scanStatus(scan)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-slate-500 py-8">
                      No scans found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
