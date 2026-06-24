import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Banknote, Wallet } from 'lucide-react';
import { resellerPayoutsApi, type ResellerWithdrawal } from '@/lib/resellerApi';

const money = (n: number) => `E ${n.toLocaleString()}`;

const STATUS_STYLES: Record<ResellerWithdrawal['status'], string> = {
  requested: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-blue-50 text-blue-700 border-blue-200',
  paid: 'bg-green-50 text-green-700 border-green-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
};

export function ResellerPayoutsPage() {
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['reseller-payouts'],
    queryFn: () => resellerPayoutsApi.overview(),
  });

  const requestPayout = useMutation({
    mutationFn: () => resellerPayoutsApi.request(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reseller-payouts'] });
      toast.success('Payout requested');
    },
    onError: (e: any) => toast.error(e?.message || 'Could not request payout'),
  });

  const available = data?.available ?? 0;
  const withdrawals = data?.withdrawals ?? [];
  const hasOpenRequest = withdrawals.some(
    (w) => w.status === 'requested' || w.status === 'approved',
  );
  const canRequest = available > 0 && !hasOpenRequest && !requestPayout.isPending;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-5 flex items-center gap-2">
        <Banknote className="h-6 w-6 text-orange-600" />
        <h1 className="text-2xl font-bold text-slate-900">Payouts</h1>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {(error as Error).message || 'Failed to load payouts'}
        </div>
      )}

      {/* Available balance */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 p-2.5 text-white">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Available commission</p>
            <p className="text-2xl font-bold text-slate-900">
              {isLoading ? '…' : money(available)}
            </p>
          </div>
        </div>

        <button
          onClick={() => requestPayout.mutate()}
          disabled={!canRequest}
          className="mt-4 w-full rounded-lg bg-gradient-to-r from-orange-600 to-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {requestPayout.isPending
            ? 'Requesting…'
            : hasOpenRequest
              ? 'Request pending'
              : 'Request payout'}
        </button>

        {requestPayout.isError && (
          <p className="mt-2 text-sm text-red-600">
            {(requestPayout.error as Error).message || 'Could not request payout'}
          </p>
        )}
        {available <= 0 && !hasOpenRequest && (
          <p className="mt-2 text-center text-xs text-slate-400">
            No commission available to withdraw yet.
          </p>
        )}
      </div>

      {/* History */}
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
        <p className="mb-3 font-semibold text-slate-900">Request history</p>
        {withdrawals.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">No payout requests yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {withdrawals.map((w) => (
              <div key={w._id} className="flex items-center justify-between py-3">
                <div className="min-w-0">
                  <p className="font-semibold tabular-nums text-slate-900">{money(w.amount)}</p>
                  <p className="text-xs text-slate-500">
                    Requested {format(new Date(w.requestedAt), 'dd MMM yyyy')}
                    {w.paidAt && ` · Paid ${format(new Date(w.paidAt), 'dd MMM yyyy')}`}
                    {w.paymentReference && ` · Ref ${w.paymentReference}`}
                  </p>
                </div>
                <span
                  className={`ml-3 shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[w.status]}`}
                >
                  {w.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
