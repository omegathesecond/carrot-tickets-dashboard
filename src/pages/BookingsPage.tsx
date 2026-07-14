import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

function formatDate(value?: string): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'cancelled' || status === 'refunded' || status === 'failed') return 'destructive';
  if (status === 'paid' || status === 'confirmed' || status === 'completed') return 'default';
  return 'secondary';
}

export function BookingsPage() {
  const { data: bookings, isLoading } = useQuery({
    queryKey: ['transport', 'bookings'],
    queryFn: () => apiClient.transport.listBookings(),
  });

  if (isLoading) return <div className="p-8">Loading...</div>;

  const rows = bookings ?? [];

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Bus Bookings</h1>
        <p className="text-slate-600">All seat purchases across your trips</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Booking Ref</TableHead>
                  <TableHead>Passenger</TableHead>
                  <TableHead>Seat</TableHead>
                  <TableHead className="text-right">Fare</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Booked</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-slate-500 py-8">
                      No bookings yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((b) => (
                    <TableRow key={b._id}>
                      <TableCell className="font-mono text-sm">{b.bookingRef}</TableCell>
                      <TableCell>
                        <div className="font-medium">{b.passengerName}</div>
                        <div className="text-xs text-slate-500">{b.passengerPhone}</div>
                      </TableCell>
                      <TableCell>{b.seatNumber || 'GA'}</TableCell>
                      <TableCell className="text-right">E {b.fareAmount}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(b.status)}>{b.status}</Badge>
                      </TableCell>
                      <TableCell>{formatDate(b.createdAt)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
