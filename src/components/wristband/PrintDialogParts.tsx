import { Printer } from 'lucide-react';
import type { WristbandBatch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

/** Split out of PrintDialog to keep that file under the line budget. */

export function ProgressBar({ done, total }: { done: number; total: number }) {
  return (
    <div className="space-y-1">
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${Math.round((done / total) * 100)}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">Rendering band {done} of {total}…</p>
    </div>
  );
}

/** Reprintable history for the "New batch" tab — the recovery path when a
 *  batch was issued but its PDF failed to render. */
export function RecentBatches({ batches, busy, onReprint }: {
  batches: WristbandBatch[];
  busy: boolean;
  onReprint: (b: WristbandBatch) => void;
}) {
  return (
    <div className="space-y-2 border-t pt-3">
      <Label className="text-xs text-muted-foreground">Recent batches</Label>
      <div className="max-h-40 space-y-1 overflow-auto">
        {batches.map((b) => (
          <div key={b._id} className="flex items-center justify-between rounded border px-2 py-1 text-sm">
            <span>{b.ticketType} × {b.quantity} — {new Date(b.soldAt).toLocaleString()}</span>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => onReprint(b)}>
              <Printer className="mr-1 h-3.5 w-3.5" /> Print
            </Button>
          </div>
        ))}
        {batches.length === 0 && <p className="text-xs text-muted-foreground">No batches issued yet.</p>}
      </div>
    </div>
  );
}
