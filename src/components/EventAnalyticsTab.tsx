import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  RadialBarChart,
  RadialBar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import { DateRangePicker, DateRange } from '@/components/DateRangePicker';
import {
  CHART_COLORS,
  PAYMENT_METHOD_COLORS,
  VIBRANT_PALETTE,
  CHART_CONFIG,
  formatCurrency,
  formatNumber,
  formatPercentage,
  getTicketTypeColor,
} from '@/lib/chartColors';

interface EventAnalyticsTabProps {
  eventId: string;
}

export function EventAnalyticsTab({ eventId }: EventAnalyticsTabProps) {
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: undefined,
    endDate: undefined,
    preset: 'all',
  });

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['eventAnalytics', eventId, dateRange],
    queryFn: () => apiClient.analytics.getEventAnalytics(eventId, {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    }),
    enabled: !!eventId,
  });

  const { data: revenueStats } = useQuery({
    queryKey: ['eventRevenueStats', eventId, dateRange],
    queryFn: () => apiClient.analytics.getRevenueStats({
      eventId,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    }),
    enabled: !!eventId,
  });

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse text-center">Loading analytics...</div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-600">No analytics data available</p>
      </div>
    );
  }

  // Transform daily revenue data for timeline
  const revenueTimelineData = revenueStats?.dailyRevenue?.map((day) => ({
    date: format(new Date(day.date), 'MMM dd'),
    revenue: day.revenue,
    tickets: day.ticketsSold,
  })) || [];

  // Transform ticket types for pie chart
  const ticketTypeData = analytics.ticketTypes.map((tt) => ({
    name: tt.name,
    value: tt.sold,
    revenue: tt.revenue,
    available: tt.available,
  }));

  // Transform payment methods for pie chart
  const paymentMethodData = revenueStats?.revenueByPaymentMethod?.map((method) => ({
    name: method.method === 'keshless_wallet' ? 'Wallet' : 'Cash',
    value: method.amount,
    count: method.count,
  })) || [];

  // Check-in rate data for radial chart
  const checkInRateData = [
    {
      name: 'Check-in Rate',
      value: analytics.sales.checkInRate,
      fill: CHART_COLORS.success,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Date Range Filter */}
      <div className="flex justify-end">
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* Summary Stats — shown at the top for an at-a-glance overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-slate-900">
              {formatCurrency(analytics.sales.totalRevenue)}
            </div>
            <div className="text-sm text-slate-600">Total Revenue</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-slate-900">
              {analytics.sales.ticketsSold.toLocaleString()}
            </div>
            <div className="text-sm text-slate-600">Tickets Sold</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-slate-900">
              {analytics.sales.checkedIn.toLocaleString()}
            </div>
            <div className="text-sm text-slate-600">Checked In</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-slate-900">
              {analytics.sales.totalSales.toLocaleString()}
            </div>
            <div className="text-sm text-slate-600">Total Sales</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              {revenueTimelineData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueTimelineData} margin={CHART_CONFIG.margin}>
                    <defs>
                      <linearGradient id="eventRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLORS.revenue} stopOpacity={0.4} />
                        <stop offset="95%" stopColor={CHART_COLORS.revenue} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid {...CHART_CONFIG.grid} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      tickFormatter={(value) => formatNumber(value)}
                    />
                    <Tooltip
                      {...CHART_CONFIG.tooltip}
                      formatter={(value: number, name: string) => {
                        if (name === 'revenue') return [formatCurrency(value), 'Revenue'];
                        return [value, 'Tickets'];
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke={CHART_COLORS.revenue}
                      strokeWidth={3}
                      fill="url(#eventRevenueGradient)"
                      animationDuration={CHART_CONFIG.animationDuration}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500">
                  No revenue data available for this period
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Ticket Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Ticket Type Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              {ticketTypeData.length > 0 && ticketTypeData.some((t) => (t.value as number) > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={ticketTypeData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }: any) =>
                        (percent as number) > 0 ? `${name}: ${((percent as number) * 100).toFixed(0)}%` : ''
                      }
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                      animationDuration={CHART_CONFIG.animationDuration}
                    >
                      {ticketTypeData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={getTicketTypeColor(index)}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      {...CHART_CONFIG.tooltip}
                      formatter={(value: number, name: string, props: any) => [
                        `${value} tickets (${formatCurrency(props.payload.revenue)})`,
                        name,
                      ]}
                    />
                    <Legend {...CHART_CONFIG.legend} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500">
                  No tickets sold yet
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Check-in Rate */}
        <Card>
          <CardHeader>
            <CardTitle>Check-in Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80 flex items-center justify-center">
              {analytics.sales.ticketsSold > 0 ? (
                <div className="w-full">
                  <ResponsiveContainer width="100%" height={300}>
                    <RadialBarChart
                      cx="50%"
                      cy="50%"
                      innerRadius="60%"
                      outerRadius="100%"
                      data={checkInRateData}
                      startAngle={180}
                      endAngle={0}
                    >
                      <RadialBar
                        background
                        dataKey="value"
                        cornerRadius={10}
                        fill={CHART_COLORS.success}
                      />
                      <text
                        x="50%"
                        y="50%"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="text-4xl font-bold"
                        fill={CHART_COLORS.success}
                      >
                        {formatPercentage(analytics.sales.checkInRate)}
                      </text>
                      <text
                        x="50%"
                        y="60%"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="text-sm"
                        fill="#64748b"
                      >
                        of tickets checked in
                      </text>
                    </RadialBarChart>
                  </ResponsiveContainer>
                  <div className="mt-4 text-center space-y-2">
                    <div className="text-sm text-slate-600">
                      <span className="font-semibold">{analytics.sales.checkedIn}</span> of{' '}
                      <span className="font-semibold">{analytics.sales.ticketsSold}</span> tickets checked in
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-slate-500">
                  No tickets sold yet
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Payment Method Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Method Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              {paymentMethodData.length > 0 && paymentMethodData.some((p) => (p.value as number) > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentMethodData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }: any) =>
                        (percent as number) > 0 ? `${name}: ${((percent as number) * 100).toFixed(0)}%` : ''
                      }
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                      animationDuration={CHART_CONFIG.animationDuration}
                    >
                      {paymentMethodData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={PAYMENT_METHOD_COLORS[entry.name.toLowerCase()] || VIBRANT_PALETTE[index]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      {...CHART_CONFIG.tooltip}
                      formatter={(value: number, name: string, props: any) => [
                        `${formatCurrency(value)} (${props.payload.count} transactions)`,
                        name,
                      ]}
                    />
                    <Legend {...CHART_CONFIG.legend} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500">
                  No payment data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
