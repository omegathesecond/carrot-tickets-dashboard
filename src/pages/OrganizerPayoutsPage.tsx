import { Guarantees } from '@/components/Guarantees';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { formatMoney } from '@/lib/currency';
import type { PayoutStatus } from '@/types/eventPayout';
import {
  BankSummary,
  PayoutSummary,
  PayoutHistory,
} from '@/components/PayoutSummary';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

export function OrganizerPayoutsPage() {
  const [showGuarantees, setShowGuarantees] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [paidAt, setPaidAt] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  const client = useQueryClient();
  const list = useQuery({
    queryKey: ['payout-requests', search, status, page],
    queryFn: () => apiClient.payoutRequests.list(search, status, page),
  });
  const detail = useQuery({
    queryKey: ['payout-request', selected],
    queryFn: () => apiClient.payoutRequests.detail(selected!),
    enabled: !!selected,
    gcTime: 0,
  });
  const decide = useMutation({
    mutationFn: (decision: PayoutStatus) =>
      apiClient.payoutRequests.decide(selected!, {
        status: decision,
        note,
        ...(decision === 'paid'
          ? {
              paidAt: new Date(paidAt).toISOString(),
              paymentReference,
              paymentCompleted,
            }
          : {}),
      }),
    onSuccess: () => {
      toast.success('Payout request updated; organizer notified');
      setSelected(null);
      void client.invalidateQueries({ queryKey: ['payout-requests'] });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      void detail.refetch();
    },
  });
  const request = detail.data;
  return (
    <div className="p-6 space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold">Payouts</h1>
        <p className="text-slate-500">
          Review event proceeds, bank details and payment history.
        </p>
      </div>
      <details className="bg-white border rounded-lg p-4" onToggle={e => setShowGuarantees(e.currentTarget.open)}><summary className="font-semibold cursor-pointer">Guarantee requests — admin review</summary><div className="mt-4">{showGuarantees && <Guarantees admin />}</div></details>
      <div className="flex flex-wrap gap-4">
        <div className="space-y-1 flex-1 min-w-48">
          <Label htmlFor="payout-search">Search</Label>
          <Input
            id="payout-search"
            value={search}
            maxLength={120}
            placeholder="Event, organizer or payment reference"
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="payout-status">Status</Label>
          <select
            className="block h-10 border rounded-md px-3 bg-white"
            id="payout-status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {['pending', 'approved', 'declined', 'paid'].map((s) => (
              <option key={s} value={s}>
                {s[0].toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>
      {list.isPending ? (
        <p role="status">Loading payout requests…</p>
      ) : list.isError ? (
        <p role="alert">
          Could not load requests: {list.error.message}{' '}
          <Button onClick={() => void list.refetch()}>Retry</Button>
        </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  {[
                    'Event / date',
                    'Organizer',
                    'Requested',
                    'Available at request',
                    'Requested on',
                    'Status',
                    '',
                  ].map((h, i) => (
                    <th key={i} className="p-4 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {list.data.items.map((p) => (
                  <tr key={p._id}>
                    <td className="p-4">
                      <p className="font-medium">{p.eventName}</p>
                      <p className="text-slate-500">
                        {new Date(p.eventDate).toLocaleDateString()}
                      </p>
                    </td>
                    <td className="p-4">{p.organizerName}</td>
                    <td className="p-4 tabular-nums">
                      {formatMoney(p.amount, p.currency, { decimals: 2 })}
                    </td>
                    <td className="p-4 tabular-nums">
                      {formatMoney(p.breakdown.availableBalance, p.currency, {
                        decimals: 2,
                      })}
                    </td>
                    <td className="p-4">
                      {new Date(p.createdAt).toLocaleString()}
                    </td>
                    <td className="p-4 capitalize">{p.status}</td>
                    <td className="p-4">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelected(p._id);
                          setNote('');
                          setPaidAt('');
                          setPaymentReference('');
                          setPaymentCompleted(false);
                        }}
                      >
                        Review
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {list.data.items.length === 0 && (
              <p className="p-8 text-slate-500">
                No payout requests match these filters.
              </p>
            )}
          </div>
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-500">
              {list.data.total} requests · Page {page}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                disabled={page * 25 >= list.data.total}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open && !decide.isPending) setSelected(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Payout request details</DialogTitle>
            <DialogDescription>
              Bank details are confidential. Mark paid only after the bank
              transfer has completed.
            </DialogDescription>
          </DialogHeader>
          {detail.isPending ? (
            <p role="status">Loading request…</p>
          ) : detail.isError ? (
            <p role="alert">Could not load request: {detail.error.message}</p>
          ) : (
            request && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold">
                    {request.eventName} ·{' '}
                    {new Date(request.eventDate).toLocaleDateString()}
                  </h2>
                  <p>
                    {request.organizerName} ·{' '}
                    <span className="capitalize">{request.status}</span>
                  </p>
                  <p>
                    Requested{' '}
                    {formatMoney(request.amount, request.currency, {
                      decimals: 2,
                    })}{' '}
                    on {new Date(request.createdAt).toLocaleString()}
                  </p>
                </div>
                <section className="space-y-3">
                  <h3 className="font-semibold">Bank details</h3>
                  <BankSummary bank={request.bank} />
                </section>
                <section>
                  <h3 className="font-semibold">Breakdown at request</h3>
                  <PayoutSummary
                    breakdown={request.breakdown}
                    currency={request.currency}
                  />
                </section>
                {request.balanceError && (
                  <p role="alert" className="text-red-700">
                    Live balance unavailable: {request.balanceError}. Reconcile
                    before payment, or decline this request.
                  </p>
                )}
                {request.currentBreakdown && (
                  <section>
                    <h3 className="font-semibold">
                      Current transaction breakdown
                    </h3>
                    <PayoutSummary
                      breakdown={request.currentBreakdown}
                      currency={request.currency}
                    />
                  </section>
                )}
                <section className="space-y-3">
                  <h3 className="font-semibold">Request history</h3>
                  <PayoutHistory request={request} />
                </section>
                {(request.status === 'pending' ||
                  request.status === 'approved') && (
                  <div className="space-y-3 border-t pt-4">
                    <Label htmlFor="payout-note">
                      Note to organizer (optional)
                    </Label>
                    <Input
                      id="payout-note"
                      maxLength={1000}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                    {request.status === 'pending' ? (
                      <div className="flex gap-3">
                        <Button
                          disabled={decide.isPending || !!request.balanceError}
                          onClick={() => decide.mutate('approved')}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="destructive"
                          disabled={decide.isPending}
                          onClick={() => decide.mutate('declined')}
                        >
                          Decline
                        </Button>
                      </div>
                    ) : (
                      <form
                        className="space-y-3"
                        onSubmit={(e) => {
                          e.preventDefault();
                          decide.mutate('paid');
                        }}
                      >
                        <Label htmlFor="paid-at">Payment completed at</Label>
                        <Input
                          required
                          id="paid-at"
                          type="datetime-local"
                          value={paidAt}
                          onChange={(e) => setPaidAt(e.target.value)}
                        />
                        <Label htmlFor="payment-reference">
                          Payment reference
                        </Label>
                        <Input
                          required
                          id="payment-reference"
                          maxLength={120}
                          value={paymentReference}
                          onChange={(e) => setPaymentReference(e.target.value)}
                        />
                        <label className="flex gap-2 items-start">
                          <input
                            required
                            type="checkbox"
                            checked={paymentCompleted}
                            onChange={(e) =>
                              setPaymentCompleted(e.target.checked)
                            }
                          />
                          I confirm this payment has completed.
                        </label>
                        <div className="flex gap-3">
                          <Button
                            variant="destructive"
                            type="button"
                            disabled={decide.isPending}
                            onClick={() => decide.mutate('declined')}
                          >
                            Decline
                          </Button>
                          <Button
                            type="submit"
                            disabled={decide.isPending || !paymentCompleted}
                          >
                            {decide.isPending ? 'Saving…' : 'Mark Paid'}
                          </Button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </div>
            )
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
