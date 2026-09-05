import { useQuery } from '@tanstack/react-query';
import { apiClient, type StockProductRow, type StockMovementRow } from '@/lib/api';
import { fmtR } from '@/lib/money';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from '@/components/ui/table';

/** One stall's line for this product, as the stock board reports it. */
export type StallLevel = {
  merchantId: string;
  merchantName: string;
  onHand: number;
  unitsSold: number;
};

const REASON_LABEL: Record<string, string> = {
  receive: 'Received',
  sale: 'Sold',
  transfer_in: 'Transferred in',
  transfer_out: 'Transferred out',
  count_adjust: 'Stock count',
  spoilage: 'Spoilage',
  manual: 'Manual',
};

/**
 * Everything about one product in one place: what it costs, which stalls carry
 * it and how much each has, and the movement journal behind those numbers.
 *
 * The history is not a new record — StockService writes a StockMovement leg for
 * every change already, so this reads the audit trail that always existed.
 */
export function ProductStockDialog({
  eventId, product, levels, onClose,
}: {
  eventId: string;
  product: StockProductRow | null;
  levels: StallLevel[];
  onClose: () => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['stock-movements', eventId, product?._id],
    queryFn: () => apiClient.events.getEventStockMovements(eventId, { productId: product!._id, limit: 50 }),
    enabled: !!product,
  });
  const movements: StockMovementRow[] = data?.movements ?? [];
  const totalOnHand = levels.reduce((n, l) => n + l.onHand, 0);

  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{product?.name}</DialogTitle></DialogHeader>

        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span><span className="text-muted-foreground">Price </span><span className="font-semibold">{product ? fmtR(product.price) : '—'}</span></span>
          <span><span className="text-muted-foreground">On hand </span><span className="font-semibold tabular-nums">{totalOnHand}</span></span>
          {product?.active === false && (
            <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[11px] font-medium text-gray-700">Inactive</span>
          )}
        </div>

        <div>
          <div className="mb-1 text-sm font-semibold">Stalls</div>
          {levels.length === 0 ? (
            <p className="text-sm text-muted-foreground">Not on any stall — it does not appear on a handheld.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Stall</TableHead>
                  <TableHead className="text-right">Sold</TableHead>
                  <TableHead className="text-right">On hand</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {levels.map((l) => (
                  <TableRow key={l.merchantId}>
                    <TableCell>{l.merchantName}</TableCell>
                    <TableCell className="text-right tabular-nums">{l.unitsSold}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{l.onHand}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <div>
          <div className="mb-1 text-sm font-semibold">Stock history</div>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading history…</p>
          ) : movements.length === 0 ? (
            <p className="text-sm text-muted-foreground">No movements recorded yet.</p>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>What</TableHead>
                    <TableHead>Stall</TableHead>
                    <TableHead className="text-right">Change</TableHead>
                    <TableHead className="text-right">After</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {new Date(m.at).toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'short' })}
                      </TableCell>
                      <TableCell>
                        {REASON_LABEL[m.reason] ?? m.reason}
                        {m.note && <span className="block text-xs text-muted-foreground">{m.note}</span>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{m.merchantName}</TableCell>
                      <TableCell className={`text-right tabular-nums font-semibold ${m.delta < 0 ? 'text-red-600' : 'text-green-700'}`}>
                        {m.delta > 0 ? `+${m.delta}` : m.delta}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{m.balanceAfter}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
