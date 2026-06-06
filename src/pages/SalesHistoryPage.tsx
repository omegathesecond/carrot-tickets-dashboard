import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { format } from 'date-fns';

export function SalesHistoryPage() {
  const { data: salesData, isLoading } = useQuery({
    queryKey: ['sales'],
    queryFn: () => apiClient.sales.getSales({ limit: 100 }),
  });

  const handleExport = () => {
    apiClient.exports.exportSalesCSV();
  };

  if (isLoading) return <div className="p-8">Loading...</div>;

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

      <Card>
        <CardHeader>
          <CardTitle>Recent Sales</CardTitle>
        </CardHeader>
        <CardContent>
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
                      <Badge variant={sale.paymentStatus === 'completed' ? 'default' : 'destructive'}>
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
        </CardContent>
      </Card>
    </div>
  );
}
