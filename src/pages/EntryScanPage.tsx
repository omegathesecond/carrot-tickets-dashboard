import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScanLine, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export function EntryScanPage() {
  const [ticketId, setTicketId] = useState('');
  const [lastScan, setLastScan] = useState<any>(null);
  const queryClient = useQueryClient();

  const { data: scansData } = useQuery({
    queryKey: ['scans'],
    queryFn: () => apiClient.scans.getScans({ limit: 50 }),
  });

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
      // Check-in is the only action that writes a scan record — refresh the
      // Recent Scans list so the new entry appears immediately.
      queryClient.invalidateQueries({ queryKey: ['scans'] });
    },
    onError: (error: any) => toast.error(error.message || 'Check-in failed'),
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

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Entry Scan</h1>
        <p className="text-slate-600">Validate and check-in tickets</p>
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
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scansData?.data?.map((scan) => (
                  <TableRow key={scan._id}>
                    <TableCell className="text-sm">{format(new Date(scan.createdAt), 'HH:mm:ss')}</TableCell>
                    <TableCell>{scan.event?.name || 'N/A'}</TableCell>
                    <TableCell>
                      <Badge variant={scan.status === 'success' ? 'default' : 'destructive'}>
                        {scan.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
