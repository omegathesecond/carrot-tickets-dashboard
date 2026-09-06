import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { apiClient, type EventTableRow, type WaiterRow } from '@/lib/api';
import { fmtR } from '@/lib/money';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

type StatusFilter = 'open' | 'settled' | 'voided';

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'settled', label: 'Settled' },
  { value: 'voided', label: 'Voided' },
];

/**
 * How far a settled table's stalls have got with handing their stock over.
 *
 * Counted rather than listed: an organizer watching the floor wants to know
 * whether anything is outstanding, not which particular counter is slow —
 * that is the waiter's screen, and it names the stalls.
 */
function handoverOf(t: EventTableRow) {
  const rows = t.fulfilment ?? [];
  if (t.status !== 'settled' || rows.length === 0) return null;
  const collected = rows.filter((f) => f.status === 'collected').length;
  const ready = rows.filter((f) => f.status === 'handed_out').length;
  return { collected, ready, total: rows.length };
}

function HandoverCell({ table }: { table: EventTableRow }) {
  const h = handoverOf(table);
  if (!h) return <span className="text-muted-foreground">—</span>;
  if (h.collected === h.total) {
    return <Badge variant="secondary" className="bg-green-100 text-green-800">All collected</Badge>;
  }
  return (
    <span className="text-sm">
      <span className="font-semibold">{h.collected}</span>
      <span className="text-muted-foreground">/{h.total} collected</span>
      {h.ready > 0 && (
        <Badge variant="secondary" className="ml-2 bg-amber-100 text-amber-800">
          {h.ready} ready
        </Badge>
      )}
    </span>
  );
}

/**
 * The organizer's view of the floor: every table their waiters opened, what it
 * is worth, and where its handover has got to.
 *
 * Read-only on purpose. An organizer opening or settling a table from here
 * would break the attribution the whole feature rests on — every table is
 * opened by a named waiter and settled against a tag by one, and a dashboard
 * write would have neither.
 */
export function EventTablesPanel({ eventId }: { eventId: string }) {
  const [status, setStatus] = useState<StatusFilter>('open');
  const [search, setSearch] = useState('');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['event-tables', eventId],
    queryFn: () => apiClient.events.getEventTables(eventId),
    enabled: !!eventId,
  });

  // Waiter names, so a table says who opened it rather than printing the hex
  // id the API stores. Best-effort: a table's real content is its lines and
  // its money, so a failed lookup falls back to the id rather than blanking
  // the screen. Already cached by WaitersPanel under the same key.
  const { data: waiters = [] } = useQuery({
    queryKey: ['waiters', eventId],
    queryFn: () => apiClient.waiters.list(eventId),
    enabled: !!eventId,
  });
  const waiterName = useMemo(() => {
    const m = new Map<string, string>();
    (waiters as WaiterRow[]).forEach((w) => m.set(w._id, w.fullName));
    return m;
  }, [waiters]);

  const rows = useMemo(() => {
    const all = data?.[status] ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return all;
    // Label OR waiter name: an organizer looking for "Mza" may mean the table
    // or the person who opened it, and both are on screen.
    return all.filter((t) =>
      t.label.toLowerCase().includes(q) ||
      (waiterName.get(t.openedBy) ?? '').toLowerCase().includes(q));
  }, [data, status, search, waiterName]);

  const totalFor = (s: StatusFilter) =>
    s === 'open' ? data?.totals.openValue
      : s === 'settled' ? data?.totals.settledValue
        : data?.totals.voidedValue;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Every table your waiters opened, what it is worth, and how far its stalls have got with
        handing the stock over. Read-only — tables are opened and settled on the floor.
      </p>

      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div role="group" aria-label="Filter tables by status" className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={status === f.value}
              onClick={() => setStatus(f.value)}
              className={
                status === f.value
                  ? 'rounded-full bg-orange-600 px-3 py-1.5 text-sm font-medium text-white'
                  : 'rounded-full border px-3 py-1.5 text-sm text-muted-foreground hover:bg-slate-50'
              }
            >
              {f.label}
              <span className="ml-1.5 opacity-70">{(data?.[f.value] ?? []).length}</span>
            </button>
          ))}
        </div>
        <Input
          className="h-9 w-56"
          placeholder="Search table or waiter"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading && (
        <div className="flex items-center py-8 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading tables…
        </div>
      )}

      {isError && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-red-600">
            Could not load tables{error instanceof Error && error.message ? ` — ${error.message}` : ''}.
          </CardContent>
        </Card>
      )}

      {data && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between text-sm mb-4">
              <span className="text-muted-foreground">
                {rows.length} {FILTERS.find((f) => f.value === status)!.label.toLowerCase()}
                {rows.length === 1 ? ' table' : ' tables'}
              </span>
              <span className="font-semibold">{fmtR(totalFor(status) ?? 0)}</span>
            </div>

            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6">
                {search.trim()
                  ? `No table matches “${search.trim()}”.`
                  : `No ${FILTERS.find((f) => f.value === status)!.label.toLowerCase()} tables.`}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Table</TableHead>
                      <TableHead>Waiter</TableHead>
                      <TableHead className="text-right">Items</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                      <TableHead>Handover</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((t) => (
                      <TableRow key={t._id}>
                        <TableCell className="font-medium">{t.label}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {waiterName.get(t.openedBy) ?? (
                            <span className="font-mono text-xs">{t.openedBy.slice(-6)}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{t.items.length}</TableCell>
                        <TableCell className="text-right font-semibold">{fmtR(t.subtotal)}</TableCell>
                        <TableCell>
                          {t.status === 'voided'
                            ? <span className="text-muted-foreground text-sm">{t.voidReason || 'Voided'}</span>
                            : <HandoverCell table={t} />}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
