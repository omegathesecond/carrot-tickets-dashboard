import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { formatMoney } from '@/lib/currency';
import type { TagWithdrawalStatus } from '@/types/tagWithdrawal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const statusLabel = { pending: 'Requested', processing: 'Payment in progress', paid: 'Paid', rejected: 'Rejected' };
const selectClass = 'h-10 rounded-md border bg-background px-3 text-sm';
export function TagWithdrawalsPage() {
  const [params] = useSearchParams();
  const eventId = params.get('eventId') || undefined;
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [reference, setReference] = useState('');
  const [reason, setReason] = useState('');
  const [completed, setCompleted] = useState(false);
  const { user } = useAuth();
  const actor = String(user?._id);
  const client = useQueryClient();
  const list = useQuery({ queryKey: ['tag-withdrawals', search, status, page, eventId],
    queryFn: () => apiClient.tagWithdrawals.list(search, status, page, eventId), refetchInterval: 30_000 });
  const detail = useQuery({ queryKey: ['tag-withdrawal', selected], queryFn: () => apiClient.tagWithdrawals.detail(selected!),
    enabled: !!selected, gcTime: 0 });
  const decide = useMutation({
    mutationFn: (next: TagWithdrawalStatus) => apiClient.tagWithdrawals.decide(selected!, { status: next,
      ...(next === 'paid' ? { paymentReference: reference.trim(), paymentCompleted: completed } : {}),
      ...(next === 'rejected' ? { rejectionReason: reason.trim() } : {}) }),
    onSuccess: async (_row, next) => {
      toast.success(next === 'processing' ? 'Request assigned to you. Send the payout, then confirm its reference.' : next === 'paid' ? 'Payment confirmed. The attendee tracking page is updated.' : 'Request rejected and balance released.');
      await client.invalidateQueries({ queryKey: ['tag-withdrawals'] });
      if (next === 'processing') await detail.refetch(); else setSelected(null);
    },
    onError: (e: Error) => { toast.error(e.message); void detail.refetch(); },
  });
  const request = detail.data;
  const mine = request?.status === 'processing' && request.processingBy === actor;
  const details = request?.details;
  function open(id: string) { setSelected(id); setReference(''); setReason(''); setCompleted(false); }
  return <div className="p-4 md:p-6 space-y-6 max-w-7xl">
    <div><h1 className="text-2xl font-bold">Tag withdrawals</h1><p className="mt-1 text-slate-500">Pay attendees their remaining cashless balances and record payment confirmation.</p></div>
    <div className="flex flex-wrap gap-4">
      <div className="space-y-1 flex-1 min-w-48"><Label htmlFor="withdrawal-search">Search</Label><Input id="withdrawal-search" placeholder="Event, tag code or payment reference" value={search} maxLength={120} onChange={e => { setSearch(e.target.value); setPage(1); }} /></div>
      <div className="space-y-1"><Label htmlFor="withdrawal-status">Status</Label><select id="withdrawal-status" className={`${selectClass} block`} value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="">All requests</option>{Object.entries(statusLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
      <Button className="self-end" variant="outline" onClick={() => void list.refetch()}>Refresh</Button>
    </div>
    {eventId && <p className="text-sm text-slate-500">Filtered to this event. <a href="/tag-withdrawals" className="underline">Show all events</a></p>}
    {list.isLoading ? <p>Loading withdrawal requests…</p> : list.isError ? <p role="alert" className="text-red-600">{list.error.message} <Button variant="outline" onClick={() => void list.refetch()}>Retry</Button></p> : <>
      <div className="overflow-x-auto rounded-lg border"><table className="w-full text-sm"><thead className="bg-slate-50 text-left"><tr>{['Requested', 'Event / tag', 'Amount', 'Destination', 'Status', ''].map((h, i) => <th key={i} className="p-3">{h}</th>)}</tr></thead><tbody>
        {list.data?.items.map(row => <tr key={row._id} className="border-t"><td className="p-3 whitespace-nowrap">{new Date(row.createdAt).toLocaleString()}</td><td className="p-3"><p className="font-medium">{row.eventName}</p><p className="font-mono uppercase text-slate-500">{row.bandUid}</p></td><td className="p-3 font-semibold whitespace-nowrap">{formatMoney(row.amount / 100, row.currency, { decimals: 2 })}<p className="font-normal text-xs text-slate-500">{row.currency}</p></td><td className="p-3">{row.destinationSummary}<p className="text-xs text-slate-500">{row.country === 'SZ' ? 'Eswatini' : 'South Africa'}</p></td><td className="p-3">{statusLabel[row.status]}</td><td className="p-3"><Button variant="outline" onClick={() => open(row._id)}>Review</Button></td></tr>)}
        {list.data?.items.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-500">No withdrawal requests match these filters.</td></tr>}
      </tbody></table></div>
      <div className="flex items-center justify-between text-sm"><p>{list.data?.total} requests · Page {page}</p><div className="flex gap-2"><Button variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button><Button variant="outline" disabled={!list.data || page * 25 >= list.data.total} onClick={() => setPage(p => p + 1)}>Next</Button></div></div>
    </>}
    <Dialog open={!!selected} onOpenChange={open => { if (!open && !decide.isPending) setSelected(null); }}><DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Attendee withdrawal</DialogTitle><DialogDescription>Claim the request before sending money. Confirm it only after the payout has completed.</DialogDescription></DialogHeader>
      {detail.isLoading ? <p>Loading payout details…</p> : detail.isError ? <p role="alert" className="text-red-600">{detail.error.message}</p> : request && <div className="space-y-5">
        <div className="rounded-lg bg-slate-50 p-4"><p className="text-2xl font-bold">{formatMoney(request.amount / 100, request.currency, { decimals: 2 })} <span className="text-sm font-normal">{request.currency}</span></p><p>{request.eventName}</p><p className="font-mono uppercase">Tag {request.bandUid}</p><p className="mt-2 font-medium">{statusLabel[request.status]}</p></div>
        {details && <section className="space-y-1 text-sm"><h3 className="font-semibold">Contact</h3><p>{details.fullName}</p><p>{details.contactPhone}</p>{details.email && <p>{details.email}</p>}</section>}
        {(mine || request.status === 'paid') && details && <section className="rounded-lg border p-4 space-y-2 text-sm"><h3 className="font-semibold">{request.method === 'mobile_money' ? 'Mobile money payout' : 'Bank payout'} · {request.country === 'SZ' ? 'Eswatini' : 'South Africa'}</h3>
          {details.bank ? <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">{Object.entries({ Bank: details.bank.bank, 'Account holder': details.bank.accountHolder, 'Account type': details.bank.accountType, 'Account number': details.bank.accountNumber, 'Branch code': details.bank.branchCode }).map(([key, value]) => <div key={key} className="contents"><dt className="text-slate-500">{key}</dt><dd className="break-all select-all font-medium">{value}</dd></div>)}</dl> : <><p>{details.provider}</p><p className="select-all font-mono text-lg">{details.mobileNumber}</p></>}
        </section>}
        {request.status === 'pending' && <div className="space-y-2"><p className="text-sm text-slate-500">The attendee’s balance is reserved. Start processing to assign this payout to yourself and reveal payment details.</p><Button disabled={decide.isPending} onClick={() => decide.mutate('processing')}>Start processing</Button></div>}
        {request.status === 'processing' && !mine && <p className="rounded-lg bg-amber-50 p-4 text-sm">Another administrator is processing this payment. Do not send a second payout.</p>}
        {mine && <section className="space-y-3"><h3 className="font-semibold">Confirm completed payment</h3><p className="text-sm text-slate-500">Send the amount using your bank or mobile-money service, then record the transaction reference here.</p><Label htmlFor="payment-reference">Payment reference</Label><Input id="payment-reference" value={reference} maxLength={120} onChange={e => setReference(e.target.value)} /><label className="flex gap-2 text-sm"><input type="checkbox" checked={completed} onChange={e => setCompleted(e.target.checked)} />I have sent this payment and confirmed it completed.</label><Button disabled={decide.isPending || !completed || !reference.trim()} onClick={() => decide.mutate('paid')}>Confirm paid</Button></section>}
        {(request.status === 'pending' || mine) && <section className="border-t pt-4 space-y-2"><Label htmlFor="rejection-reason">Unable to pay? Give the attendee a reason</Label><Input id="rejection-reason" value={reason} maxLength={1000} onChange={e => setReason(e.target.value)} /><p className="text-xs text-slate-500">Reject only if no money was sent. The balance will be released so the attendee can request again.</p><Button variant="destructive" disabled={decide.isPending || !reason.trim()} onClick={() => decide.mutate('rejected')}>Reject and release balance</Button></section>}
        {request.paymentReference && <p className="text-sm">Payment reference: <strong>{request.paymentReference}</strong>{request.paidAt && ` · ${new Date(request.paidAt).toLocaleString()}`}</p>}
        {request.rejectionReason && <p className="text-sm">Reason: {request.rejectionReason}</p>}
        <section className="border-t pt-4"><h3 className="font-semibold mb-2">History</h3><ol className="space-y-2 text-sm">{request.history.map((item, i) => <li key={i}>{statusLabel[item.status]} · {new Date(item.at).toLocaleString()}{item.note && <p className="text-slate-500">{item.note}</p>}</li>)}</ol></section>
      </div>}
    </DialogContent></Dialog>
  </div>;
}
