import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowDownCircle, ArrowUpCircle, Nfc } from 'lucide-react';
import { apiClient, type TagMovement } from '@/lib/api';
import { fmtR, centsToRand, randToCents } from '@/lib/money';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString('en-ZA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

/** One tag: who holds it, what is on it, every band it has been, every movement. */
export function TagDetailSheet({
  eventId, walletId, onClose,
}: { eventId: string; walletId: string | null; onClose: () => void }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['tag-detail', eventId, walletId],
    queryFn: () => apiClient.tags.detail(eventId, walletId!),
    enabled: !!walletId,
  });

  const queryClient = useQueryClient();
  const [action, setAction] = useState<null | 'refund' | 'deactivate' | 'reissue'>(null);
  const [amountRand, setAmountRand] = useState('');
  const [reason, setReason] = useState('');
  const [newUid, setNewUid] = useState('');
  // One key per opened dialog: a double-click cannot become a double refund.
  const [txnKey, setTxnKey] = useState('');

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['tag-detail', eventId, walletId] });
    queryClient.invalidateQueries({ queryKey: ['tags', eventId] });
    queryClient.invalidateQueries({ queryKey: ['tag-summary', eventId] });
  };

  const refundM = useMutation({
    mutationFn: () => {
      const cents = randToCents(amountRand);
      // Fail loud rather than send a fabricated 0.
      if (cents == null || cents <= 0) throw new Error('Enter a valid amount');
      return apiClient.tags.refund(eventId, walletId!, cents, txnKey);
    },
    onSuccess: () => { invalidate(); setAction(null); toast.success('Refund recorded'); },
    onError: (e: Error) => toast.error(e.message || 'Could not record the refund'),
  });

  const deactivateM = useMutation({
    mutationFn: () => apiClient.tags.deactivate(eventId, walletId!, reason.trim()),
    onSuccess: () => { invalidate(); setAction(null); setReason(''); toast.success('Tag deactivated'); },
    onError: (e: Error) => toast.error(e.message || 'Could not deactivate the tag'),
  });

  const reissueM = useMutation({
    mutationFn: () => apiClient.tags.reissue(eventId, walletId!, newUid.trim()),
    onSuccess: () => { invalidate(); setAction(null); setNewUid(''); toast.success('Tag reissued'); },
    onError: (e: Error) => toast.error(e.message || 'Could not reissue the tag'),
  });

  const openRefund = (balance: number) => {
    setAmountRand(centsToRand(balance));
    setTxnKey(`refund-${walletId}-${crypto.randomUUID()}`);
    setAction('refund');
  };

  return (
    <Dialog open={!!walletId} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Tag detail</DialogTitle></DialogHeader>

        {isLoading ? (
          <p className="py-8 text-center text-muted-foreground">Loading…</p>
        ) : error || !data ? (
          <p className="py-8 text-center text-muted-foreground">
            {(error as Error)?.message || 'Could not load this tag.'}
          </p>
        ) : (
          <div className="space-y-5">
            <div>
              <div className="text-lg font-semibold">{data.holder.name ?? 'Unknown holder'}</div>
              <div className="text-sm text-muted-foreground">
                {data.holder.phone ?? '—'}{data.holder.ticketCode ? ` · ticket ${data.holder.ticketCode}` : ''}
              </div>
            </div>

            <div className="rounded-lg border p-3">
              <div className="text-2xl font-bold">{fmtR(data.balance)}</div>
              <div className="text-xs text-muted-foreground">
                {fmtR(data.cashFundedBalance)} cash-funded · currently on{' '}
                <span className="font-mono">{data.bandUid ?? 'no tag'}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setAction('deactivate')}>Report lost</Button>
              <Button variant="outline" size="sm" onClick={() => setAction('reissue')}>Reissue</Button>
              <Button size="sm" className="bg-orange-600 hover:bg-orange-700" onClick={() => openRefund(data.balance)}>Refund</Button>
            </div>

            {action === 'refund' && (
              <div className="rounded-lg border p-3 space-y-2">
                <Label htmlFor="refund-amount">Amount (R)</Label>
                <Input id="refund-amount" inputMode="decimal" value={amountRand} onChange={(e) => setAmountRand(e.target.value)} />
                <p className="text-xs text-muted-foreground">
                  This records cash handed over at the office. It does not send money anywhere.
                </p>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setAction(null)}>Cancel</Button>
                  <Button size="sm" disabled={refundM.isPending} className="bg-orange-600 hover:bg-orange-700" onClick={() => refundM.mutate()}>
                    {refundM.isPending ? 'Recording…' : 'Record refund'}
                  </Button>
                </div>
              </div>
            )}

            {action === 'deactivate' && (
              <div className="rounded-lg border p-3 space-y-2">
                <Label htmlFor="lost-reason">What happened?</Label>
                <Input id="lost-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. lost at the bar" />
                <p className="text-xs text-muted-foreground">The balance stays on the wallet and moves to the replacement tag.</p>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setAction(null)}>Cancel</Button>
                  <Button size="sm" disabled={deactivateM.isPending || !reason.trim()} onClick={() => deactivateM.mutate()}>
                    {deactivateM.isPending ? 'Working…' : 'Deactivate tag'}
                  </Button>
                </div>
              </div>
            )}

            {action === 'reissue' && (
              <div className="rounded-lg border p-3 space-y-2">
                <Label htmlFor="new-uid">New tag UID</Label>
                <Input id="new-uid" value={newUid} onChange={(e) => setNewUid(e.target.value)} placeholder="Tap or type the new tag's UID" />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setAction(null)}>Cancel</Button>
                  <Button size="sm" disabled={reissueM.isPending || !newUid.trim()} onClick={() => reissueM.mutate()}>
                    {reissueM.isPending ? 'Working…' : 'Reissue'}
                  </Button>
                </div>
              </div>
            )}

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Tag history</h3>
              {data.bindings.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tag has been bound yet.</p>
              ) : data.bindings.map((b, i) => (
                <div key={`${b.bandUid}-${i}`} className="flex items-start gap-2 text-sm border-b border-slate-100 pb-2">
                  <Nfc className="h-4 w-4 mt-0.5 text-orange-600 shrink-0" />
                  <div>
                    <div className="font-mono text-xs">{b.bandUid}</div>
                    <div className="text-xs text-muted-foreground">
                      Bound {fmtWhen(b.boundAt)}{b.boundBy ? ` by ${b.boundBy}` : ''}
                      {b.unboundAt ? ` · released ${fmtWhen(b.unboundAt)}` : ''}
                      {b.unboundReason ? ` — ${b.unboundReason}` : ''}
                    </div>
                  </div>
                  {!b.unboundAt && <Badge variant="secondary" className="ml-auto bg-green-100 text-green-800">Current</Badge>}
                </div>
              ))}
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Movements</h3>
              {data.movements.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing yet.</p>
              ) : data.movements.map((m: TagMovement, i) => (
                <div key={i} className="flex items-center gap-2 text-sm border-b border-slate-100 pb-2">
                  {m.kind === 'topup'
                    ? <ArrowDownCircle className="h-4 w-4 text-green-600 shrink-0" />
                    : <ArrowUpCircle className="h-4 w-4 text-orange-600 shrink-0" />}
                  <span className="flex-1">{m.label}</span>
                  <span className="text-xs text-muted-foreground">{fmtWhen(m.at)}</span>
                  <span className="font-semibold tabular-nums">{fmtR(m.amount)}</span>
                </div>
              ))}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
