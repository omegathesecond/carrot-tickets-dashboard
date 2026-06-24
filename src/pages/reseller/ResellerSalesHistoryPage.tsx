import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight, Receipt } from 'lucide-react';
import { resellerReportsApi, type ManagerSale } from '@/lib/resellerApi';

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  mtn_momo: 'MTN MoMo',
  keshless_wallet: 'Keshless Wallet',
};

const STATUS_STYLES: Record<string, string> = {
  completed: 'bg-green-100 text-green-700',
  pending: 'bg-amber-100 text-amber-700',
  failed: 'bg-red-100 text-red-700',
};

const money = (n: number) => `E ${n.toLocaleString()}`;

function isoFrom(d: string) {
  return d ? `${d}T00:00:00` : undefined;
}
function isoTo(d: string) {
  return d ? `${d}T23:59:59` : undefined;
}

export function ResellerSalesHistoryPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['reseller-manager-sales', from, to, page],
    queryFn: () =>
      resellerReportsApi.managerSales({
        page,
        limit: 25,
        from: isoFrom(from),
        to: isoTo(to),
      }),
    placeholderData: keepPreviousData,
  });

  const sales: ManagerSale[] = data?.data ?? [];
  const pg = data?.pagination;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-5 flex items-center gap-2">
        <Receipt className="h-6 w-6 text-orange-600" />
        <h1 className="text-2xl font-bold text-slate-900">Sales History</h1>
      </div>

      {/* Date filter */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
          />
        </div>
        {(from || to) && (
          <button
            onClick={() => {
              setFrom('');
              setTo('');
              setPage(1);
            }}
            className="h-10 rounded-lg px-3 text-sm text-slate-600 hover:bg-slate-100"
          >
            Clear
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {(error as Error).message || 'Failed to load sales'}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Event</th>
              <th className="px-4 py-3">Operator</th>
              <th className="px-4 py-3">Hub</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            ) : sales.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                  No sales in this range.
                </td>
              </tr>
            ) : (
              sales.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {format(new Date(s.soldAt), 'dd MMM yyyy HH:mm')}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">{s.eventName || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{s.operatorName || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{s.hubName || '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{s.quantity}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">
                    {money(s.totalAmount)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {METHOD_LABELS[s.paymentMethod] ?? s.paymentMethod}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUS_STYLES[s.paymentStatus] ?? 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {s.paymentStatus}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pg && pg.total > 0 && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
          <span>
            {pg.total} sale{pg.total === 1 ? '' : 's'} · page {pg.page} of {pg.pages}
          </span>
          <div className="flex gap-2">
            <button
              disabled={!pg.hasPrev}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </button>
            <button
              disabled={!pg.hasNext}
              onClick={() => setPage((p) => p + 1)}
              className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
