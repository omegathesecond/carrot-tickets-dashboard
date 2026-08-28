import { useEffect, useMemo, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Users, UserPlus, CalendarDays, Ticket } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatsCard } from '@/components/ui/stats-card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '@/lib/chartColors';
import { TablePagination } from '@/components/TablePagination';

const PAGE_SIZE = 25;

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function UsersPage() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Debounce the search box so we don't refetch on every keystroke, and reset
  // to page 1 whenever the query changes.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['userAnalytics'],
    queryFn: () => apiClient.users.analytics(),
  });

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['users', search, page],
    queryFn: () => apiClient.users.list({ search, page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const signupSeries = useMemo(
    () =>
      (analytics?.signups ?? []).map((s) => ({
        date: new Date(s.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
        count: s.count,
      })),
    [analytics],
  );

  const users = usersData?.users ?? [];
  const pagination = usersData?.pagination;

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Users</h1>
        <p className="text-sm text-slate-500">Everyone who has signed up on Carrot Tickets.</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total users"
          value={analyticsLoading ? '—' : (analytics?.totalUsers ?? 0).toLocaleString()}
          description="Registered accounts"
          icon={Users}
          gradient="from-orange-500 to-orange-600"
        />
        <StatsCard
          title="New this week"
          value={analyticsLoading ? '—' : (analytics?.newThisWeek ?? 0).toLocaleString()}
          description="Signed up in the last 7 days"
          icon={UserPlus}
          gradient="from-amber-500 to-amber-600"
        />
        <StatsCard
          title="New this month"
          value={analyticsLoading ? '—' : (analytics?.newThisMonth ?? 0).toLocaleString()}
          description="Signed up in the last 30 days"
          icon={CalendarDays}
          gradient="from-orange-400 to-amber-500"
        />
        <StatsCard
          title="Active buyers"
          value={analyticsLoading ? '—' : (analytics?.activeBuyers ?? 0).toLocaleString()}
          description="Users with at least one purchase"
          icon={Ticket}
          gradient="from-amber-600 to-orange-700"
        />
      </div>

      {/* Signups over time */}
      <Card>
        <CardHeader>
          <CardTitle>Signups over time</CardTitle>
        </CardHeader>
        <CardContent>
          {analyticsLoading ? (
            <p className="text-sm text-slate-500 py-8 text-center">Loading…</p>
          ) : signupSeries.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">No signups in the last 30 days yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={signupSeries} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <Tooltip />
                <Line type="monotone" dataKey="count" name="Signups" stroke="#f97316" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Users table */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>All users</CardTitle>
          <Input
            placeholder="Search by name, phone or email…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="sm:max-w-xs"
          />
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Last active</TableHead>
                  <TableHead className="text-right">Tickets</TableHead>
                  <TableHead className="text-right">Spent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-slate-500 py-8">Loading…</TableCell>
                  </TableRow>
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-slate-500 py-8">
                      {search ? 'No users match your search.' : 'No users yet.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.name || '—'}</TableCell>
                      <TableCell className="font-mono text-sm">{u.phone || u.email || '—'}</TableCell>
                      <TableCell>{formatDate(u.createdAt)}</TableCell>
                      <TableCell>{formatDate(u.lastLoginAt)}</TableCell>
                      <TableCell className="text-right">{u.ticketsBought}</TableCell>
                      <TableCell className="text-right">{formatCurrency(u.totalSpent)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <TablePagination
            page={pagination?.page ?? page}
            totalPages={pagination?.totalPages ?? 0}
            total={pagination?.total ?? 0}
            itemLabel="user"
            onPageChange={setPage}
            busy={usersLoading}
          />
        </CardContent>
      </Card>
    </div>
  );
}
