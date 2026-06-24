import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { CHANNEL_LABEL } from '@/lib/channel';
import { formatCurrency } from '@/lib/chartColors';
import { paymentLabel } from '@/lib/payment';

const COLORS = ['#f97316', '#fb923c', '#fdba74', '#fed7aa'];

export function AnalyticsPage() {
  const [channel, setChannel] = useState<string>('all');

  const { data: revenueStats, isLoading } = useQuery({
    queryKey: ['revenueStats', channel],
    queryFn: () => apiClient.analytics.getRevenueStats({
      ...(channel !== 'all' ? { channel: channel as 'online' | 'box_office' | 'reseller_pos' } : {}),
    }),
  });

  if (isLoading) return <div className="p-8">Loading...</div>;

  const paymentMethodData = revenueStats?.revenueByPaymentMethod?.map(pm => ({
    name: paymentLabel(pm.method),
    value: pm.amount,
  })) || [];

  const eventRevenueData = revenueStats?.revenueByEvent?.map(e => ({
    name: e.eventName,
    revenue: e.revenue,
    tickets: e.ticketsSold,
  })) || [];

  const channelData = revenueStats?.revenueByChannel?.map(c => ({
    name: CHANNEL_LABEL[c.channel] ?? c.channel,
    value: c.amount,
  })) || [];

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Analytics</h1>
        <p className="text-slate-600">Insights and reports</p>
      </div>

      <div className="flex flex-wrap gap-4 items-end">
        <div className="space-y-2">
          <Label>Channel</Label>
          <Select value={channel} onValueChange={setChannel}>
            <SelectTrigger className="w-44"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All channels</SelectItem>
              <SelectItem value="online">Online</SelectItem>
              <SelectItem value="box_office">Organizer</SelectItem>
              <SelectItem value="reseller_pos">Reseller POS</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Event</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={eventRevenueData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="revenue" fill="#f97316" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment Method Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentMethodData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label
                  >
                    {paymentMethodData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sales by Channel</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={channelData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                  {channelData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Top Reseller Sources</CardTitle></CardHeader>
        <CardContent>
          {(revenueStats?.topResellerSources?.length ?? 0) === 0 ? (
            <div className="py-6 text-center text-slate-500">No reseller sales in this range</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reseller</TableHead>
                  <TableHead>Hub</TableHead>
                  <TableHead>Sales</TableHead>
                  <TableHead>Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {revenueStats!.topResellerSources!.map((s, i) => (
                  <TableRow key={i}>
                    <TableCell>{s.resellerName}</TableCell>
                    <TableCell>{s.hubName}</TableCell>
                    <TableCell>{s.count}</TableCell>
                    <TableCell>{formatCurrency(s.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
