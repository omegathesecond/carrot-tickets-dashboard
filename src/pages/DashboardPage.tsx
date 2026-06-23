import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Ticket, Calendar, ScanLine, TrendingUp } from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import { DateRangePicker, DateRange } from '@/components/DateRangePicker';
import { useAuth } from '@/contexts/AuthContext';
import { TicketsPermission, hasPermission } from '@/lib/permissions';
import {
  CHART_COLORS,
  PAYMENT_METHOD_COLORS,
  VIBRANT_PALETTE,
  CHART_CONFIG,
  formatCurrency,
  formatNumber,
} from '@/lib/chartColors';

export function DashboardPage() {
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: undefined,
    endDate: undefined,
    preset: 'all',
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboardStats', dateRange],
    queryFn: () => apiClient.analytics.getDashboardStats({
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    }),
  });

  const { data: revenueStats, isLoading: revenueLoading } = useQuery({
    queryKey: ['revenueStats', dateRange],
    queryFn: () => apiClient.analytics.getRevenueStats({
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    }),
  });

  const isLoading = statsLoading || revenueLoading;

  if (isLoading) {
    return <div className="p-8"><div className="animate-pulse">Loading...</div></div>;
  }

  // Transform daily revenue data for chart
  const revenueChartData = revenueStats?.dailyRevenue?.map((day) => ({
    date: format(new Date(day.date), 'MMM dd'),
    revenue: day.revenue,
    tickets: day.ticketsSold,
  })) || [];

  // Transform payment method data for pie chart
  const paymentMethodData = revenueStats?.revenueByPaymentMethod?.map((method) => ({
    name: method.method === 'keshless_wallet' ? 'Wallet' : 'Cash',
    value: method.amount,
    count: method.count,
  })) || [];

  // Transform event data for bar chart (top 5 events)
  const topEventsData = revenueStats?.revenueByEvent?.slice(0, 5).map((event) => ({
    name: event.eventName.length > 15 ? event.eventName.substring(0, 15) + '...' : event.eventName,
    revenue: event.revenue,
    tickets: event.ticketsSold,
  })) || [];

  const statsCards = [
    {
      title: 'Total Revenue',
      value: `E ${(stats?.totalRevenue || 0).toLocaleString()}`,
      icon: DollarSign,
      change: stats?.revenueChange,
      color: 'text-green-600 bg-green-50',
    },
    {
      title: 'Tickets Sold',
      value: (stats?.ticketsSold || 0).toLocaleString(),
      icon: Ticket,
      change: stats?.salesChange,
      color: 'text-blue-600 bg-blue-50',
    },
    {
      title: 'Active Events',
      value: stats?.activeEvents || 0,
      icon: Calendar,
      change: stats?.eventsChange,
      color: 'text-purple-600 bg-purple-50',
    },
    // Hidden for sales-only accounts (resellers) that can't scan entries.
    ...(hasPermission(user, TicketsPermission.VIEW_SCANS)
      ? [
          {
            title: "Today's Scans",
            value: stats?.todayScans || 0,
            icon: ScanLine,
            change: stats?.scansChange,
            color: 'text-orange-600 bg-orange-50',
          },
        ]
      : []),
  ];

  return (
    <div className="p-8 space-y-8">
      {/* Header with Date Range Filter */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-600">Overview of your ticketing business</p>
        </div>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${stat.color}`}>
                <stat.icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              {stat.change !== undefined && (
                <div className="flex items-center text-sm mt-1">
                  <TrendingUp className={`h-4 w-4 mr-1 ${stat.change >= 0 ? 'text-green-600' : 'text-red-600'}`} />
                  <span className={stat.change >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {stat.change >= 0 ? '+' : ''}{stat.change}%
                  </span>
                  <span className="text-slate-600 ml-1">from last period</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Revenue Overview Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueChartData} margin={CHART_CONFIG.margin}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.revenue} stopOpacity={0.3} />
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
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke={CHART_COLORS.revenue}
                  strokeWidth={3}
                  dot={{ fill: CHART_COLORS.revenue, r: 4 }}
                  activeDot={{ r: 6 }}
                  animationDuration={CHART_CONFIG.animationDuration}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Additional Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ticket Sales Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Ticket Sales Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueChartData} margin={CHART_CONFIG.margin}>
                  <defs>
                    <linearGradient id="ticketsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
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
                  />
                  <Tooltip
                    {...CHART_CONFIG.tooltip}
                    formatter={(value: number) => [value, 'Tickets Sold']}
                  />
                  <Area
                    type="monotone"
                    dataKey="tickets"
                    stroke={CHART_COLORS.primary}
                    strokeWidth={3}
                    fill="url(#ticketsGradient)"
                    animationDuration={CHART_CONFIG.animationDuration}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Payment Method Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Sales by Payment Method</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentMethodData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }: any) => `${name}: ${((percent as number) * 100).toFixed(0)}%`}
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
            </div>
          </CardContent>
        </Card>

        {/* Top Selling Events */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Top Selling Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topEventsData} margin={{ ...CHART_CONFIG.margin, left: 10 }}>
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.secondary} stopOpacity={0.9} />
                      <stop offset="95%" stopColor={CHART_COLORS.secondary} stopOpacity={0.6} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...CHART_CONFIG.grid} />
                  <XAxis
                    dataKey="name"
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
                      return [value, 'Tickets Sold'];
                    }}
                  />
                  <Legend {...CHART_CONFIG.legend} />
                  <Bar
                    dataKey="revenue"
                    fill="url(#barGradient)"
                    radius={[8, 8, 0, 0]}
                    animationDuration={CHART_CONFIG.animationDuration}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
