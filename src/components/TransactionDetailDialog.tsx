import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

const fmtR = (c?: number) =>
  c === undefined || c === null ? '—' : `R${(c / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtFull = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—'
    : d.toLocaleString('en-ZA', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
};
const bandRef = (uid?: string) => (uid ? uid.toUpperCase() : '—');

/** One transaction, normalised from any of the three logs (event / vendor / cashier). */
export interface TxnDetail {
  id: string;
  type: 'topup' | 'withdrawal' | 'purchase';
  amount: number;
  at: string;
  actorName?: string;
  actorType?: string;
  bandUid?: string;
  fee?: number;
  netAmount?: number;
  status?: string;
}

const TYPE_META: Record<TxnDetail['type'], { label: string; className: string; sign: string }> = {
  topup: { label: 'Top-up', className: 'bg-green-100 text-green-800', sign: '+' },
  withdrawal: { label: 'Cash-out', className: 'bg-orange-100 text-orange-800', sign: '−' },
  purchase: { label: 'Purchase', className: 'bg-blue-100 text-blue-800', sign: '−' },
};

const ACTOR_LABEL: Record<string, string> = {
  Merchant: 'Vendor', Cashier: 'Cashier', ResellerOperator: 'Reseller', Platform: 'Platform',
};

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b last:border-b-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`text-sm text-slate-900 text-right ${mono ? 'font-mono' : 'font-medium'}`}>{value}</span>
    </div>
  );
}

export function TransactionDetailDialog({ txn, onClose }: { txn: TxnDetail | null; onClose: () => void }) {
  if (!txn) return null;
  const meta = TYPE_META[txn.type];
  return (
    <Dialog open={!!txn} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Badge variant="secondary" className={meta.className}>{meta.label}</Badge>
            Transaction
          </DialogTitle>
        </DialogHeader>
        <div className="mt-1">
          <div className="text-center py-3">
            <div className="text-3xl font-bold text-slate-900">{meta.sign}{fmtR(txn.amount)}</div>
          </div>
          <div className="rounded-lg border px-4">
            {txn.actorName && (
              <Row label={ACTOR_LABEL[txn.actorType ?? ''] ?? 'By'} value={txn.actorName} />
            )}
            {txn.type === 'purchase' && (
              <>
                <Row label="Vendor net" value={fmtR(txn.netAmount)} />
                <Row label="Commission" value={fmtR(txn.fee)} />
              </>
            )}
            {txn.bandUid && <Row label="Band" value={bandRef(txn.bandUid)} mono />}
            <Row label="When" value={fmtFull(txn.at)} />
            {txn.status && (
              <Row label="Status" value={<Badge variant="secondary" className="bg-green-100 text-green-800">{txn.status}</Badge>} />
            )}
            <Row label="Reference" value={txn.id} mono />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
