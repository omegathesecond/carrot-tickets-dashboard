import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { guaranteeStatus, type GuaranteeRequest, type GuaranteeInput } from '@/types/guarantee';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';

export function Guarantees({ eventId, admin = false }: { eventId?: string; admin?: boolean }) {
  const { user } = useAuth();
  const owner = user?.userType === 'vendor';
  const organizer = !!eventId && owner;
  const client = useQueryClient();
  const [editing, setEditing] = useState<GuaranteeRequest | null>(null);
  const [form, setForm] = useState<GuaranteeInput>({ providerId: '', amount: 0, description: '', expectedPaymentDate: '' });
  const list = useQuery({ queryKey: ['guarantees', eventId, admin], queryFn: () => apiClient.guarantees.list(eventId, admin), enabled: owner || admin });
  const providers = useQuery({ queryKey: ['guarantee-providers'], queryFn: () => apiClient.guarantees.providers(), enabled: organizer });
  const financials = useQuery({ queryKey: ['event-financials', eventId], queryFn: () => apiClient.analytics.getEventFinancials(eventId!), enabled: organizer });
  const available = financials.data?.custody.availableNow;
  const refresh = () => client.invalidateQueries({ queryKey: ['guarantees'] });
  const submit = useMutation({
    mutationFn: () => apiClient.guarantees.submit(eventId!, form, editing?._id),
    onSuccess: () => { toast.success('Guarantee request saved'); setEditing(null); setForm({ providerId: '', amount: 0, description: '', expectedPaymentDate: '' }); void refresh(); },
    onError: (e: Error) => { toast.error(e.message); void financials.refetch(); },
  });
  if (!owner && !admin) return <p role="alert">Guarantees are available to account owners only.</p>;
  return <div className="space-y-6">
    <div><h2 className="text-2xl font-bold">{eventId ? 'Guarantee' : 'Guarantees'}</h2><p className="text-slate-600 mt-2">Track requests for goods and services. Provider acceptance is not Carrot approval. No funds are reserved or moved. Payment remains subject to Carrot’s existing admin approval and payment process.</p></div>
    {organizer && <Card><CardHeader><CardTitle>{editing ? 'Edit request' : 'Request a guarantee'}</CardTitle></CardHeader><CardContent>
      {financials.isPending ? <p>Loading Financials balance…</p> : financials.isError ? <p role="alert" className="text-red-700">Balance unavailable: {financials.error.message}. Submission is blocked. <Button variant="outline" onClick={() => void financials.refetch()}>Retry</Button></p> : <p className="mb-4">Available ticket-sales balance: {financials.data?.currency} {available?.toFixed(2)}</p>}
      {providers.isError && <p role="alert">Providers unavailable: {providers.error.message} <Button variant="outline" onClick={() => void providers.refetch()}>Retry</Button></p>}
      <form className="grid gap-4 md:grid-cols-2" onSubmit={e => { e.preventDefault(); submit.mutate(); }}>
        <div><Label htmlFor="guarantee-provider">Service provider</Label><select id="guarantee-provider" className="w-full rounded-md border p-2 bg-white" required value={form.providerId} onChange={e => setForm({ ...form, providerId: e.target.value })}><option value="">Select a provider</option>{providers.data?.map(p => <option key={p._id} value={p._id}>{p.businessName}</option>)}</select></div>
        <div><Label htmlFor="guarantee-amount">Amount</Label><Input id="guarantee-amount" type="number" min="0.01" step="0.01" max={available} required value={form.amount || ''} onChange={e => setForm({ ...form, amount: Number(e.target.value) })}/></div>
        <div className="md:col-span-2"><Label htmlFor="guarantee-description">Goods or services</Label><textarea id="guarantee-description" className="w-full rounded-md border p-2" maxLength={4000} required value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}/></div>
        <div><Label htmlFor="guarantee-date">Expected payment date</Label><Input id="guarantee-date" type="date" required value={form.expectedPaymentDate} onChange={e => setForm({ ...form, expectedPaymentDate: e.target.value })}/></div>
        <p className="text-sm text-slate-600">Changing the provider removes any existing agreement. After saving, you can attach a signed PDF agreement to the request below. Only you, the selected provider and Carrot admins can download it.</p>
        <div className="flex gap-2"><Button disabled={submit.isPending || providers.isPending || providers.isError || financials.isPending || financials.isError || !Number.isFinite(available) || form.amount > available! || available! <= 0}>{submit.isPending ? 'Saving…' : editing ? 'Save changes' : 'Submit request'}</Button>{editing && <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel editing</Button>}</div>
      </form>
    </CardContent></Card>}
    {list.isPending && <p>Loading requests…</p>}
    {list.isError && <p role="alert">{list.error.message} <Button variant="outline" onClick={() => void list.refetch()}>Retry</Button></p>}
    {list.data?.length === 0 && <p className="text-slate-600">No guarantee requests yet.</p>}
    {list.data?.map(request => <GuaranteeCard key={request._id} request={request} organizer={organizer} admin={admin} refresh={refresh} edit={() => { setEditing(request); setForm({ providerId: request.providerId, amount: request.amount, description: request.description, expectedPaymentDate: request.expectedPaymentDate.slice(0, 10) }); }}/>) }
  </div>;
}
function GuaranteeCard({ request: r, organizer, admin, refresh, edit }: { request: GuaranteeRequest; organizer: boolean; admin: boolean; refresh: () => Promise<unknown>; edit: () => void }) {
  const [note, setNote] = useState('');
  const decision = useMutation({ mutationFn: (status: string) => apiClient.guarantees.respond(r._id, status, note, admin), onSuccess: () => { setNote(''); toast.success('Status updated; organizer and provider notified'); void refresh(); }, onError: (e: Error) => { toast.error(e.message); void refresh(); } });
  const attachment = useMutation({ mutationFn: (file: File) => apiClient.guarantees.attach(r._id, file), onSuccess: () => { toast.success('Agreement attached'); void refresh(); }, onError: (e: Error) => toast.error(e.message) });
  const canRespond = organizer ? r.status === 'requested' : admin ? ['accepted', 'pending'].includes(r.status) : r.status === 'requested';
  return <Card><CardHeader><div className="flex flex-wrap gap-3 justify-between"><CardTitle>{r.eventName}</CardTitle><span className="text-sm font-semibold text-orange-800">{guaranteeStatus(r.status)}</span></div></CardHeader><CardContent className="space-y-4">
    <dl className="grid md:grid-cols-2 gap-3"><div><dt className="text-sm text-slate-500">Organizer</dt><dd>{r.organizerName}</dd></div><div><dt className="text-sm text-slate-500">Service provider</dt><dd>{r.providerName}</dd></div><div><dt className="text-sm text-slate-500">Amount</dt><dd className="font-semibold">{r.currency} {r.amount.toFixed(2)}</dd></div><div><dt className="text-sm text-slate-500">Expected payment date</dt><dd>{r.expectedPaymentDate.slice(0, 10)}</dd></div></dl>
    <p className="whitespace-pre-wrap">{r.description}</p>
    {r.agreementName && <Button variant="outline" onClick={() => void apiClient.guarantees.agreement(r._id).catch((e: Error) => toast.error(e.message))}>Download agreement: {r.agreementName}</Button>}
    {organizer && r.status === 'requested' && <div className="space-y-2"><Button variant="outline" onClick={edit}>Edit request</Button><div><Label htmlFor={`agreement-${r._id}`}>Attach signed agreement (PDF, up to 5 MB)</Label><Input id={`agreement-${r._id}`} type="file" accept="application/pdf" disabled={attachment.isPending} onChange={e => { const file = e.target.files?.[0]; if (file) attachment.mutate(file); e.target.value = ''; }}/></div></div>}
    {canRespond && <div className="space-y-3"><Label htmlFor={`note-${r._id}`}>Optional note</Label><Input id={`note-${r._id}`} value={note} maxLength={1000} onChange={e => setNote(e.target.value)}/><div className="flex flex-wrap gap-2">{(organizer ? ['withdrawn'] : admin ? ['pending', 'paid', 'rejected'] : ['accepted', 'provider_rejected']).map(status => <Button key={status} variant={status.includes('reject') || status === 'withdrawn' ? 'outline' : 'default'} disabled={decision.isPending} onClick={() => decision.mutate(status)}>{({ withdrawn: 'Withdraw', accepted: 'Accept request', provider_rejected: 'Reject request', pending: 'Mark Pending', paid: 'Mark Paid', rejected: 'Reject' } as Record<string, string>)[status]}</Button>)}</div>{admin && <p className="text-sm text-slate-600">Mark Paid only after completing payment through the existing admin process.</p>}</div>}
    <details><summary className="cursor-pointer font-medium">Status history and notes</summary><ol className="mt-3 space-y-3">{r.history.map((h, i) => <li key={i} className="border-l-2 pl-3"><p>{guaranteeStatus(h.status)} · <time dateTime={h.at}>{new Date(h.at).toLocaleString()}</time></p><p className="text-xs text-slate-500">Recorded by {h.by}</p>{h.note && <p className="whitespace-pre-wrap">{h.note}</p>}</li>)}</ol></details>
  </CardContent></Card>;
}
