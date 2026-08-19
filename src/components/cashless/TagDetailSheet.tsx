import { useQuery } from '@tanstack/react-query';
import { ArrowDownCircle, ArrowUpCircle, Nfc } from 'lucide-react';
import { apiClient, type TagMovement } from '@/lib/api';
import { fmtR } from '@/lib/money';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

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
