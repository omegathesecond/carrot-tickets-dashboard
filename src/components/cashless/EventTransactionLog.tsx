import { useEffect, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { fmtR } from '@/lib/money';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { TransactionDetailDialog, type TxnDetail } from '@/components/TransactionDetailDialog';

const TXN_LABEL: Record<string, { label: string; className: string }> = {
  topup: { label: 'Top-up', className: 'bg-green-100 text-green-800' },
  withdrawal: { label: 'Cash-out', className: 'bg-orange-100 text-orange-800' },
  purchase: { label: 'Purchase', className: 'bg-blue-100 text-blue-800' },
};

const fmtWhen = (iso: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('en-ZA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

/**
 * Every rand that moved at this event, with what it takes to answer "what
 * happened to MY money" at the desk: the reference to quote, the tag it moved
 * on, who moved it, and whether it went through.
 *
 * Searching is by TAG, server-side — one tag's movements can be spread over
 * hundreds of pages, so filtering the page you happen to be on would answer a
 * different question than the one asked.
 */
export function EventTransactionLog({ eventId }: { eventId: string }) {
  const [tagInput, setTagInput] = useState('');
  const [tagQuery, setTagQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<TxnDetail | null>(null);

  // Debounced: a UID is 8–14 characters and one request per keystroke would
  // put a dozen searches on the wire for a single tag.
  useEffect(() => {
    const t = setTimeout(() => { setTagQuery(tagInput.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [tagInput]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['event-cashless-txns', eventId, tagQuery, page],
    queryFn: () => apiClient.events.getEventCashlessTransactions(eventId, {
      page, limit: 50, ...(tagQuery ? { tagUid: tagQuery } : {}),
    }),
    retry: false,
    // Keeps the table on screen while the next page loads, so paging doesn't
    // flash an empty log.
    placeholderData: keepPreviousData,
  });

  const rows = data?.transactions ?? [];

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-8 pr-8"
          placeholder="Search by tag ID"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
        />
        {tagInput && (
          <button
            type="button"
            aria-label="Clear tag search"
            className="absolute right-2 top-2.5 text-muted-foreground hover:text-slate-700"
            onClick={() => setTagInput('')}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-4">Loading transactions…</p>
          ) : error ? (
            <p className="text-sm text-red-600 py-4">
              Could not load the transaction log{(error as Error)?.message ? ` — ${(error as Error).message}` : ''}.
            </p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              {tagQuery ? `Nothing moved on a tag matching “${tagQuery}”.` : 'No transactions yet.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Transaction ref</TableHead>
                    <TableHead>Tag ID</TableHead>
                    <TableHead>By</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((t) => {
                    const meta = TXN_LABEL[t.type] ?? { label: t.type, className: 'bg-gray-100 text-gray-800' };
                    return (
                      <TableRow
                        key={t.id}
                        className="cursor-pointer hover:bg-slate-50"
                        onClick={() => setSelected({
                          id: t.id, type: t.type, amount: t.amount, at: t.at,
                          actorName: t.actorName, actorType: t.actorType,
                          bandUid: t.tagUid ?? t.bandUid, fee: t.fee, netAmount: t.netAmount,
                          ref: t.ref, status: t.status,
                        })}
                      >
                        <TableCell className="text-muted-foreground whitespace-nowrap">{fmtWhen(t.at)}</TableCell>
                        <TableCell className="font-mono text-xs max-w-[14rem] truncate" title={t.ref ?? ''}>
                          {t.ref || '—'}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{t.tagUid ?? t.bandUid ?? '—'}</TableCell>
                        <TableCell className="font-medium">{t.actorName ?? '—'}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={meta.className}>{meta.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">{fmtR(t.amount)}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            {t.status ?? 'completed'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {(page > 1 || data?.hasMore) && (
                <div className="flex items-center justify-between pt-4">
                  <span className="text-xs text-muted-foreground">Page {page}</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                      Previous
                    </Button>
                    <Button variant="outline" size="sm" disabled={!data?.hasMore} onClick={() => setPage((p) => p + 1)}>
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <TransactionDetailDialog txn={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
