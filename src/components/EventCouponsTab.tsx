import { useState, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Copy, Plus, RefreshCw, TicketPercent } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { formatMoney } from '@/lib/currency';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Event } from '@/types';
import type { CreateCouponsInput } from '@/types/eventCoupon';

export function EventCouponsTab({ eventId, event }: { eventId: string; event: Event }) {
  const cache = useQueryClient();
  const [page, setPage] = useState(1);
  const [label, setLabel] = useState('');
  const [count, setCount] = useState('1');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [value, setValue] = useState('');
  const [ticketTypeIds, setTicketTypeIds] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState('');
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
  const queryKey = ['eventCoupons', eventId, page];
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey, queryFn: () => apiClient.coupons.list(eventId, page), refetchInterval: 30000,
  });
  const create = useMutation({
    mutationFn: (input: CreateCouponsInput) => apiClient.coupons.create(eventId, input),
    onSuccess: (result) => {
      setGeneratedCodes(result.coupons.map(c => c.code));
      setPage(1);
      void cache.invalidateQueries({ queryKey: ['eventCoupons', eventId] });
      toast.success(`${result.coupons.length} single-use ${result.coupons.length === 1 ? 'code' : 'codes'} generated`);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const disable = useMutation({
    mutationFn: (couponId: string) => apiClient.coupons.disable(eventId, couponId),
    onSuccess: () => { void cache.invalidateQueries({ queryKey: ['eventCoupons', eventId] }); toast.success('Coupon disabled'); },
    onError: (error: Error) => toast.error(error.message),
  });
  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast.success('Copied'); }
    catch { toast.error('Could not copy. Select and copy the code manually.'); }
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate({ count: Number(count), label, discountType, discountValue: Number(value), ticketTypeIds,
      ...(expiresAt ? { expiresAt: new Date(expiresAt).toISOString() } : {}) });
  };

  return <div className="space-y-6">
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><TicketPercent className="h-5 w-5" />Event coupons</CardTitle></CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">Give each person a unique code. Each code works once, for one eligible ticket at this event. In a group booking, it discounts the highest-priced eligible ticket. Service fees apply to tickets that still have a price.</p>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="coupon-label">Label or recipient (optional)</Label><Input id="coupon-label" value={label} onChange={e => setLabel(e.target.value)} maxLength={100} placeholder="e.g. Guest list — Sarah" /></div>
            <div className="space-y-2"><Label htmlFor="coupon-count">Number of unique codes</Label><Input id="coupon-count" type="number" min={1} max={100} step={1} required value={count} onChange={e => setCount(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="coupon-type">Discount type</Label><select id="coupon-type" className="flex h-10 w-full rounded-md border bg-background px-3 text-sm" value={discountType} onChange={e => setDiscountType(e.target.value as 'percentage' | 'fixed')}><option value="percentage">Percentage off</option><option value="fixed">Fixed amount off ({event.currency})</option></select></div>
            <div className="space-y-2"><Label htmlFor="coupon-value">{discountType === 'percentage' ? 'Percentage (up to 100%)' : `Amount (${event.currency})`}</Label><Input id="coupon-value" type="number" min="0.01" max={discountType === 'percentage' ? 100 : undefined} step="0.01" required value={value} onChange={e => setValue(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="coupon-expiry">Expires at (optional, your local time)</Label><Input id="coupon-expiry" type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} /></div>
          </div>
          <fieldset className="space-y-2"><legend className="text-sm font-medium mb-2">Eligible ticket types (leave empty for all organizer tickets)</legend>
            <div className="flex flex-wrap gap-x-5 gap-y-3">{event.ticketTypes.filter(t => !t.isAllocation).map(t => <label key={t._id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ticketTypeIds.includes(t._id)} onChange={e => setTicketTypeIds(ids => e.target.checked ? [...ids, t._id] : ids.filter(id => id !== t._id))} />{t.name}</label>)}</div>
          </fieldset>
          <p className="text-xs text-muted-foreground">Codes can be passed to anyone; the label is for your records. A 100% discount makes that ticket free. A fixed discount is capped at the ticket price.</p>
          <Button type="submit" disabled={create.isPending}><Plus className="h-4 w-4 mr-2" />{create.isPending ? 'Generating…' : 'Generate codes'}</Button>
        </form>
        {generatedCodes.length > 0 && <div className="rounded-lg border bg-muted/30 p-4 space-y-3" aria-live="polite"><p className="text-sm font-medium">Your new codes</p><div className="max-h-40 overflow-auto font-mono text-sm select-all whitespace-pre-wrap break-all">{generatedCodes.join('\n')}</div><Button type="button" variant="outline" onClick={() => void copy(generatedCodes.join('\n'))}><Copy className="h-4 w-4 mr-2" />Copy new codes</Button></div>}
      </CardContent>
    </Card>
    <Card>
      <CardHeader className="flex flex-row items-center justify-between"><CardTitle>Codes & usage{data ? ` (${data.total})` : ''}</CardTitle><Button variant="outline" size="sm" disabled={isFetching} onClick={() => void refetch()}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button></CardHeader>
      <CardContent>
        {error ? <div role="alert" className="text-sm text-destructive">Could not load coupon usage: {error.message}</div> : isLoading ? <p className="text-sm">Loading coupons…</p> : data?.coupons.length === 0 ? <p className="text-sm text-muted-foreground">No coupons yet. Generate your first code above.</p> : <div className="divide-y">{data?.coupons.map(c => <div key={c._id} className="py-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1"><div className="flex flex-wrap items-center gap-2"><code className="text-sm font-semibold break-all">{c.code}</code><Badge variant="secondary">{{ available: 'Available', pending: 'Payment pending', used: 'Used', expired: 'Expired', disabled: 'Disabled' }[c.status]}</Badge></div>
            {c.label && <p className="text-sm">{c.label}</p>}<p className="text-sm text-muted-foreground">{c.discountType === 'percentage' ? `${c.discountValue}%` : formatMoney(c.discountValue, event.currency)} off one ticket · {c.ticketTypeIds.length ? c.ticketTypeIds.map(id => event.ticketTypes.find(t => t._id === id)?.name ?? 'Removed ticket type').join(', ') : 'All organizer tickets'}</p>
            {c.expiresAt && <p className="text-xs text-muted-foreground">Expires {new Date(c.expiresAt).toLocaleString()}</p>}
            {c.redemption && <p className="text-xs">Redeemed{c.redemption.customerName ? ` by ${c.redemption.customerName}` : ''}{c.redemption.usedAt ? ` on ${new Date(c.redemption.usedAt).toLocaleString()}` : ''} · saved {formatMoney(c.redemption.discountAmount, event.currency)}</p>}
            {c.status === 'pending' && <p className="text-xs text-muted-foreground">Reserved until the payment is confirmed or fails.</p>}
          </div><div className="flex gap-2"><Button variant="outline" size="sm" aria-label={`Copy ${c.code}`} onClick={() => void copy(c.code)}><Copy className="h-4 w-4" /></Button>{c.status === 'available' && <Button variant="outline" size="sm" disabled={disable.isPending} onClick={() => disable.mutate(c._id)}>Disable</Button>}</div>
        </div>)}</div>}
        {data && data.total > 50 && <div className="flex justify-between items-center pt-4"><Button variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button><span className="text-sm">Page {page} of {Math.ceil(data.total / 50)}</span><Button variant="outline" disabled={page * 50 >= data.total} onClick={() => setPage(p => p + 1)}>Next</Button></div>}
      </CardContent>
    </Card>
  </div>;
}
