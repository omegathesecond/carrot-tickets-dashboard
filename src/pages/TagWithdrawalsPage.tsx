import { useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowDownToLine, ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Inbox, Loader2, RefreshCw, Search, Tag, XCircle } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { canViewTagWithdrawals } from '@/lib/permissions';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { formatMoney } from '@/lib/currency';
import type { TagWithdrawalStatus } from '@/types/tagWithdrawal';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const statuses = {
  pending: { label: 'Requested', icon: Clock3, color: 'border-amber-100 bg-amber-50 text-amber-700' },
  processing: { label: 'Payment in progress', icon: Loader2, color: 'border-blue-100 bg-blue-50 text-blue-700' },
  paid: { label: 'Paid', icon: CheckCircle2, color: 'border-emerald-100 bg-emerald-50 text-emerald-700' },
  rejected: { label: 'Rejected', icon: XCircle, color: 'border-rose-100 bg-rose-50 text-rose-700' },
};
const statusEntries = Object.entries(statuses) as [TagWithdrawalStatus, typeof statuses[TagWithdrawalStatus]][];
const tabClass = 'rounded-none border-b-2 border-transparent px-0 pb-4 pt-5 text-sm font-medium shadow-none data-[state=active]:border-orange-500 data-[state=active]:bg-transparent data-[state=active]:text-orange-600 data-[state=active]:shadow-none';

function WithdrawalStatusBadge({ status }: { status: TagWithdrawalStatus }) {
  const { label, icon: Icon, color } = statuses[status];
  return <Badge variant="outline" className={cn('gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 font-medium', color)}>
    <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />{label}
  </Badge>;
}

export function TagWithdrawalsPage() {
  const [params] = useSearchParams();
  const eventId = params.get('eventId') || undefined;
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [reference, setReference] = useState('');
  const [reason, setReason] = useState('');
  const [completed, setCompleted] = useState(false);
  const { user, isLoading } = useAuth();
  const canView = canViewTagWithdrawals(user);
  const isAdmin = !!user?.isSuperAdmin;
  const actor = String(user?._id);
  const client = useQueryClient();
  const list = useQuery({ queryKey: ['tag-withdrawals', actor, isAdmin, search, status, page, eventId],
    queryFn: () => apiClient.tagWithdrawals.list(search, status === 'all' ? '' : status, page, eventId), enabled: canView, refetchInterval: 30_000 });
  const detail = useQuery({ queryKey: ['tag-withdrawal', actor, isAdmin, selected], queryFn: () => apiClient.tagWithdrawals.detail(selected!),
    enabled: canView && !!selected, gcTime: 0 });
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
  const mine = isAdmin && request?.status === 'processing' && request.processingBy === actor;
  const details = isAdmin ? request?.details : undefined;
  function open(id: string) { setSelected(id); setReference(''); setReason(''); setCompleted(false); }
  if (isLoading) return null;
  if (!canView) return <Navigate to="/" replace />;
  return <div className="min-h-full bg-slate-50 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
    <div className="mx-auto max-w-[1440px] space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-orange-100 bg-orange-50 text-orange-600 sm:flex">
            <ArrowDownToLine aria-hidden="true" className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Tag withdrawals</h1>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">{isAdmin ? 'Review attendee balances and manage payouts.' : 'Track attendee withdrawal requests for your events.'}</p>
          </div>
        </div>
        <Button aria-label="Refresh" variant="outline" className="h-10 w-10 shrink-0 gap-2 rounded-lg bg-white px-0 text-slate-600 shadow-none sm:h-9 sm:w-auto sm:px-4" disabled={list.isFetching} onClick={() => void list.refetch()}>
          <RefreshCw aria-hidden="true" className={cn('h-4 w-4', list.isFetching && 'animate-spin')} /><span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>
      {eventId && <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-orange-100 bg-orange-50 px-4 py-3 text-sm text-orange-800">
        <span>Showing requests for this event</span><Link to="/tag-withdrawals" className="inline-flex items-center gap-1 font-medium hover:underline">Show all events<ArrowRight aria-hidden="true" className="h-3.5 w-3.5" /></Link>
      </div>}
      <Tabs value={status} onValueChange={value => { setStatus(value); setPage(1); }} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto border-b border-slate-200 px-5 sm:px-6">
          <TabsList aria-label="Withdrawal status" className="h-auto w-max justify-start gap-6 rounded-none bg-transparent p-0 text-slate-500">
            <TabsTrigger value="all" className={tabClass}>All</TabsTrigger>
            {statusEntries.map(([key, { label }]) => <TabsTrigger key={key} value={key} className={tabClass}>{label}</TabsTrigger>)}
          </TabsList>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
          <p className="text-sm font-medium text-slate-600" aria-live="polite">{list.isLoading ? 'Loading requests…' : list.isError ? 'Requests unavailable' : `${list.data?.total ?? 0} ${list.data?.total === 1 ? 'request' : 'requests'}`}</p>
          <div className="relative w-full sm:w-80">
            <Label htmlFor="withdrawal-search" className="sr-only">Search</Label>
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input id="withdrawal-search" className="h-10 rounded-lg border-slate-200 bg-slate-50 pl-9 text-sm shadow-none placeholder:text-slate-400" placeholder="Search event, tag or reference…" value={search} maxLength={120} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
        </div>
        <TabsContent value={status} className="mt-0">
          {list.isLoading ? <div role="status" className="flex min-h-64 items-center justify-center gap-2 text-sm text-slate-500"><Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />Loading withdrawal requests…</div>
          : list.isError ? <div role="alert" className="m-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-red-100 bg-red-50 p-5 text-sm text-red-700"><p>{list.error.message}</p><Button variant="outline" onClick={() => void list.refetch()}>Retry</Button></div>
          : <>
            <table role="table" aria-label="Withdrawal requests" className="block w-full text-left text-sm xl:table">
              <thead role="rowgroup" className="hidden bg-slate-50/80 xl:table-header-group"><tr role="row">
                {['Event / tag', 'Requested', 'Destination', 'Amount', 'Status', ''].map((heading, i) => <th role="columnheader" key={i} className={cn('px-4 py-3 text-xs font-medium text-slate-500 first:pl-6 last:pr-6', heading === 'Amount' && 'text-right')}>{heading || <span className="sr-only">Actions</span>}</th>)}
              </tr></thead>
              <tbody role="rowgroup" className="block divide-y divide-slate-100 xl:table-row-group">
                {list.data?.items.map(row => <tr role="row" key={row._id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-4 p-5 transition-colors hover:bg-slate-50/70 xl:table-row xl:p-0">
                  <td role="cell" className="col-start-1 row-start-1 min-w-0 xl:max-w-[280px] xl:py-5 xl:pl-6 xl:pr-4">
                    <p className="break-words font-semibold leading-snug text-slate-800">{row.eventName}</p>
                    <p className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs uppercase tracking-wide text-slate-500"><Tag aria-hidden="true" className="h-3 w-3" />{row.bandUid}</p>
                  </td>
                  <td role="cell" className="col-start-1 row-start-3 self-center text-xs text-slate-400 xl:whitespace-nowrap xl:px-4 xl:py-5 xl:text-sm xl:text-slate-600">
                    <time dateTime={row.createdAt}>{new Date(row.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}<span className="ml-1.5 text-xs text-slate-400 xl:ml-0 xl:mt-1 xl:block">{new Date(row.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span></time>
                  </td>
                  <td role="cell" className="col-start-1 row-start-2 min-w-0 self-center xl:px-4 xl:py-5"><p className="break-words text-xs text-slate-600 xl:text-sm">{row.destinationSummary}</p><p className="mt-1 text-xs text-slate-400">{row.country === 'SZ' ? 'Eswatini' : 'South Africa'}</p></td>
                  <td role="cell" className="col-start-2 row-start-2 self-center text-right xl:whitespace-nowrap xl:px-4 xl:py-5"><p className="text-base font-semibold tabular-nums tracking-tight text-slate-900">{formatMoney(row.amount / 100, row.currency, { decimals: 2 })}</p><p className="mt-1 text-xs font-normal text-slate-400">{row.currency}</p></td>
                  <td role="cell" className="col-start-2 row-start-1 text-right xl:px-4 xl:py-5 xl:text-left"><WithdrawalStatusBadge status={row.status} /></td>
                  <td role="cell" className="col-start-2 row-start-3 self-center text-right xl:py-5 xl:pl-2 xl:pr-6"><Button variant="ghost" className="h-8 gap-1.5 px-2 font-medium text-orange-600 hover:bg-orange-50 hover:text-orange-700" onClick={() => open(row._id)}>{isAdmin ? 'Review' : 'View'}<ArrowRight aria-hidden="true" className="h-3.5 w-3.5" /></Button></td>
                </tr>)}
              </tbody>
            </table>
            {list.data?.items.length === 0 && <div className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
              <div className="mb-4 rounded-2xl bg-slate-50 p-4 text-slate-400"><Inbox aria-hidden="true" className="h-7 w-7" /></div>
              <p className="font-medium text-slate-700">No withdrawal requests match these filters.</p><p className="mt-1.5 text-sm text-slate-400">Try another status or search for a different event or tag.</p>
            </div>}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 text-xs text-slate-500 sm:px-6">
              <p>Page <span className="font-medium text-slate-700">{page}</span> of {Math.max(1, Math.ceil((list.data?.total ?? 0) / 25))}</p>
              <div className="flex gap-2"><Button variant="outline" size="sm" className="gap-1 rounded-lg border-slate-200 shadow-none" disabled={page === 1} onClick={() => setPage(p => p - 1)}><ChevronLeft aria-hidden="true" className="h-3.5 w-3.5" />Previous</Button><Button variant="outline" size="sm" className="gap-1 rounded-lg border-slate-200 shadow-none" disabled={!list.data || page * 25 >= list.data.total} onClick={() => setPage(p => p + 1)}>Next<ChevronRight aria-hidden="true" className="h-3.5 w-3.5" /></Button></div>
            </div>
          </>}
        </TabsContent>
      </Tabs>
    <Dialog open={!!selected} onOpenChange={open => { if (!open && !decide.isPending) setSelected(null); }}><DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border-slate-200 p-6 sm:w-full sm:p-8"><DialogHeader><DialogTitle>Attendee withdrawal</DialogTitle><DialogDescription>{isAdmin ? 'Claim the request before sending money. Confirm it only after the payout has completed.' : 'View the request status and payment history. Carrot administrators handle the payout.'}</DialogDescription></DialogHeader>
      {detail.isLoading ? <p>Loading payout details…</p> : detail.isError ? <p role="alert" className="text-red-600">{detail.error.message}</p> : request && <div className="space-y-5">
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><span className="text-xs font-medium uppercase tracking-wider text-slate-500">Withdrawal amount</span><WithdrawalStatusBadge status={request.status} /></div>
          <p className="text-3xl font-semibold tabular-nums tracking-tight text-slate-900">{formatMoney(request.amount / 100, request.currency, { decimals: 2 })} <span className="text-sm font-normal text-slate-400">{request.currency}</span></p>
          <p className="mt-3 text-sm font-medium text-slate-700">{request.eventName}</p>
          <p className="mt-1.5 font-mono text-xs uppercase tracking-wide text-slate-500">Tag {request.bandUid}</p>
          <p className="mt-3 border-t border-slate-200 pt-3 text-sm text-slate-500">{request.destinationSummary}</p>
        </div>
        {details && <section className="space-y-1 text-sm text-slate-600"><h3 className="mb-2 font-semibold text-slate-900">Contact</h3><p>{details.fullName}</p><p>{details.contactPhone}</p>{details.email && <p>{details.email}</p>}</section>}
        {(mine || request.status === 'paid') && details && <section className="rounded-xl border border-slate-200 p-5 space-y-2 text-sm"><h3 className="font-semibold">{request.method === 'mobile_money' ? 'Mobile money payout' : 'Bank payout'} · {request.country === 'SZ' ? 'Eswatini' : 'South Africa'}</h3>
          {details.bank ? <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">{Object.entries({ Bank: details.bank.bank, 'Account holder': details.bank.accountHolder, 'Account type': details.bank.accountType, 'Account number': details.bank.accountNumber, 'Branch code': details.bank.branchCode }).map(([key, value]) => <div key={key} className="contents"><dt className="text-slate-500">{key}</dt><dd className="break-all select-all font-medium">{value}</dd></div>)}</dl> : <><p>{details.provider}</p><p className="select-all font-mono text-lg">{details.mobileNumber}</p></>}
        </section>}
        {isAdmin && request.status === 'pending' && <div className="space-y-3 rounded-xl border border-orange-100 bg-orange-50/50 p-5"><p className="text-sm text-slate-500">The attendee’s balance is reserved. Start processing to assign this payout to yourself and reveal payment details.</p><Button disabled={decide.isPending} onClick={() => decide.mutate('processing')}>Start processing</Button></div>}
        {isAdmin && request.status === 'processing' && !mine && <p className="rounded-lg bg-amber-50 p-4 text-sm">Another administrator is processing this payment. Do not send a second payout.</p>}
        {mine && <section className="space-y-3 rounded-xl border border-slate-200 p-5"><h3 className="font-semibold">Confirm completed payment</h3><p className="text-sm text-slate-500">Send the amount using your bank or mobile-money service, then record the transaction reference here.</p><Label htmlFor="payment-reference">Payment reference</Label><Input id="payment-reference" value={reference} maxLength={120} onChange={e => setReference(e.target.value)} /><label className="flex gap-2 text-sm"><input type="checkbox" checked={completed} onChange={e => setCompleted(e.target.checked)} />I have sent this payment and confirmed it completed.</label><Button disabled={decide.isPending || !completed || !reference.trim()} onClick={() => decide.mutate('paid')}>Confirm paid</Button></section>}
        {isAdmin && (request.status === 'pending' || mine) && <section className="border-t border-slate-100 pt-5 space-y-2"><Label htmlFor="rejection-reason">Unable to pay? Give the attendee a reason</Label><Input id="rejection-reason" value={reason} maxLength={1000} onChange={e => setReason(e.target.value)} /><p className="text-xs text-slate-500">Reject only if no money was sent. The balance will be released so the attendee can request again.</p><Button variant="destructive" disabled={decide.isPending || !reason.trim()} onClick={() => decide.mutate('rejected')}>Reject and release balance</Button></section>}
        {request.paymentReference && <p className="text-sm">Payment reference: <strong>{request.paymentReference}</strong>{request.paidAt && ` · ${new Date(request.paidAt).toLocaleString()}`}</p>}
        {request.rejectionReason && <p className="text-sm">Reason: {request.rejectionReason}</p>}
        <section className="border-t border-slate-100 pt-5"><h3 className="mb-4 text-sm font-semibold text-slate-900">History</h3><ol className="ml-1.5 space-y-5 border-l border-slate-200 text-sm">{request.history.map((item, i) => <li key={i} className="relative pl-5"><span aria-hidden="true" className="absolute -left-1 top-1.5 h-2 w-2 rounded-full bg-orange-400 ring-4 ring-white" /><p className="font-medium text-slate-700">{statuses[item.status].label}</p><p className="mt-1 text-xs text-slate-400">{new Date(item.at).toLocaleString()}</p>{item.note && <p className="mt-1.5 text-slate-500">{item.note}</p>}</li>)}</ol></section>
      </div>}
    </DialogContent></Dialog>
    </div>
  </div>;
}
