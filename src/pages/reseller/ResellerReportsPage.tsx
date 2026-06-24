import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  BarChart3,
  DollarSign,
  Ticket,
  ShoppingBag,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { resellerReportsApi } from '@/lib/resellerApi';

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  mtn_momo: 'MTN MoMo',
  keshless_wallet: 'Keshless Wallet',
};

const money = (n: number) => `E ${n.toLocaleString()}`;
const isoFrom = (d: string) => (d ? `${d}T00:00:00` : undefined);
const isoTo = (d: string) => (d ? `${d}T23:59:59` : undefined);

export function ResellerReportsPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['reseller-reports', from, to],
    queryFn: () => resellerReportsApi.summary({ from: isoFrom(from), to: isoTo(to) }),
    placeholderData: keepPreviousData,
  });

  const chartData =
    data?.byDay.map((d) => ({ ...d, label: format(new Date(d.date), 'dd MMM') })) ?? [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-5 flex items-center gap-2">
        <BarChart3 className="h-6 w-6 text-orange-600" />
        <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
      </div>

      {/* Date filter */}
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
          />
        </div>
        {(from || to) && (
          <button
            onClick={() => {
              setFrom('');
              setTo('');
            }}
            className="h-10 rounded-lg px-3 text-sm text-slate-600 hover:bg-slate-100"
          >
            Clear
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {(error as Error).message || 'Failed to load reports'}
        </div>
      )}

      {/* Totals */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={<DollarSign className="h-5 w-5" />}
          label="Revenue"
          value={money(data?.totals.revenue ?? 0)}
          tint="from-green-500 to-emerald-600"
        />
        <StatCard
          icon={<Ticket className="h-5 w-5" />}
          label="Tickets sold"
          value={(data?.totals.tickets ?? 0).toLocaleString()}
          tint="from-orange-500 to-amber-600"
        />
        <StatCard
          icon={<ShoppingBag className="h-5 w-5" />}
          label="Sales"
          value={(data?.totals.salesCount ?? 0).toLocaleString()}
          tint="from-blue-500 to-indigo-600"
        />
      </div>

      {/* Revenue by day */}
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
        <p className="mb-3 font-semibold text-slate-900">Revenue by day</p>
        {isLoading ? (
          <div className="py-16 text-center text-slate-400">Loading…</div>
        ) : chartData.length === 0 ? (
          <div className="py-16 text-center text-slate-400">No sales in this range.</div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={48} />
                <Tooltip
                  formatter={(v: number) => money(v)}
                  labelStyle={{ color: '#0f172a' }}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
                <Bar dataKey="revenue" fill="#ea580c" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* By payment method */}
        <Breakdown
          title="By payment method"
          rows={(data?.byMethod ?? []).map((m) => ({
            name: METHOD_LABELS[m.method] ?? m.method,
            revenue: m.revenue,
            sub: `${m.count} sale${m.count === 1 ? '' : 's'} · ${m.tickets} tickets`,
          }))}
        />
        {/* By operator */}
        <Breakdown
          title="By operator"
          rows={(data?.byOperator ?? []).map((o) => ({
            name: o.fullName,
            revenue: o.revenue,
            sub: `${o.count} sale${o.count === 1 ? '' : 's'} · ${o.tickets} tickets`,
          }))}
        />
      </div>

      {/* By hub (admins) */}
      {(data?.byHub?.length ?? 0) > 1 && (
        <div className="mt-6">
          <Breakdown
            title="By hub"
            rows={(data?.byHub ?? []).map((h) => ({
              name: h.name,
              revenue: h.revenue,
              sub: `${h.count} sale${h.count === 1 ? '' : 's'} · ${h.tickets} tickets`,
            }))}
          />
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tint: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <div className={`rounded-lg bg-gradient-to-br ${tint} p-2 text-white`}>{icon}</div>
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className="text-xl font-bold text-slate-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

function Breakdown({
  title,
  rows,
}: {
  title: string;
  rows: { name: string; revenue: number; sub: string }[];
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="mb-3 font-semibold text-slate-900">{title}</p>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">No data.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center justify-between py-2.5">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-900">{r.name}</p>
                <p className="text-xs text-slate-500">{r.sub}</p>
              </div>
              <p className="ml-3 shrink-0 font-semibold tabular-nums text-slate-900">
                {money(r.revenue)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
