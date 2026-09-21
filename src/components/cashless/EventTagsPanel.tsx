import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Nfc, Search } from 'lucide-react';
import { apiClient, type TagRow, type TagStatus } from '@/lib/api';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { fmtR } from '@/lib/money';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TagDetailSheet } from '@/components/cashless/TagDetailSheet';

const STATUS_META: Record<TagStatus, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-green-100 text-green-800' },
  unbound: { label: 'Unbound', className: 'bg-amber-100 text-amber-800' },
  frozen: { label: 'Frozen', className: 'bg-slate-100 text-slate-700' },
  closed: { label: 'Closed', className: 'bg-slate-100 text-slate-700' },
};

/**
 * The tags endpoint clamps `limit` to 200, and this screen has no pager. Asking
 * for the ceiling on the funded view keeps every tag holding money on screen at
 * any event up to that many — and because the SERVER does the balance sort, a
 * cut at 200 is the 200 biggest balances rather than an arbitrary slice.
 */
const FUNDED_LIMIT = 200;

/**
 * The tags issued at one cashless event. A "tag" is really the wallet behind
 * it — the plastic carries only a UID, and the wallet is what survives a lost
 * tag being reissued, so rows are keyed and opened by walletId.
 */
export function EventTagsPanel({ eventId }: { eventId: string }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<TagStatus | 'all'>('all');
  const [openTag, setOpenTag] = useState<string | null>(null);
  // Defaults ON: the screen exists to answer "who is holding my money", and
  // the raw newest-registered order answers it badly at any event that
  // bulk-registers plastic (496 tags, 11 funded, one of them on page 1).
  const [fundedOnly, setFundedOnly] = useState(true);

  const { data: summary } = useQuery({
    queryKey: ['tag-summary', eventId],
    queryFn: () => apiClient.tags.summary(eventId),
  });

  const { data: page, isLoading } = useQuery({
    queryKey: ['tags', eventId, status, q, fundedOnly],
    queryFn: () =>
      apiClient.tags.list(eventId, {
        ...(status !== 'all' ? { status } : {}),
        ...(q.trim() ? { q: q.trim() } : {}),
        // Filtered and ordered SERVER-SIDE. This screen used to walk the cursor
        // and sift the pages itself, which meant dragging thousands of rows over
        // the wire to display the handful holding money.
        ...(fundedOnly ? { funded: true, sort: 'balance' as const, limit: FUNDED_LIMIT } : {}),
      }),
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Tags in use" value={String(summary?.tagsInUse ?? 0)} hint={`${summary?.unboundTags ?? 0} unbound`} />
        <Stat label="Still on tags" value={fmtR(summary?.balanceOutstanding ?? 0)} hint="owed to attendees" />
        <Stat label="Cash-funded" value={fmtR(summary?.cashFundedOutstanding ?? 0)} hint="collected at the office" />
        <Stat label="Average balance" value={fmtR(summary?.averageBalance ?? 0)} hint="per tag" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search tag UID, name or phone" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as TagStatus | 'all')}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="unbound">Unbound</SelectItem>
            <SelectItem value="frozen">Frozen</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 rounded-md border px-3 py-2">
          <Switch id="funded-only" checked={fundedOnly} onCheckedChange={setFundedOnly} />
          <Label htmlFor="funded-only" className="cursor-pointer whitespace-nowrap text-sm font-medium">
            Funded only
          </Label>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6 overflow-x-auto">
          {isLoading ? (
            <p className="py-8 text-center text-muted-foreground">Loading tags…</p>
          ) : !page?.tags.length ? (
            <p className="py-8 text-center text-muted-foreground">
              {!fundedOnly
                ? 'No tags issued yet.'
                : q.trim()
                  // With the filter on by default, searching the UID of an
                  // empty tag otherwise looks like "tag not found" — which at
                  // a cash-out desk is the wrong thing to conclude.
                  ? `No funded tag matches “${q.trim()}”. Switch off Funded only to include tags with no balance.`
                  : 'No tags are holding a balance.'}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tag</TableHead>
                  <TableHead>Holder</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {page.tags.map((t: TagRow) => (
                  <TableRow key={t.walletId} className="hover:bg-slate-50 cursor-pointer" onClick={() => setOpenTag(t.walletId)}>
                    <TableCell className="font-mono text-xs">
                      <span className="inline-flex items-center gap-1.5">
                        <Nfc className="h-3.5 w-3.5 text-orange-600" />
                        {t.bandUid ?? '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{t.holder.name ?? 'Unknown'}</div>
                      <div className="text-xs text-muted-foreground">{t.holder.phone ?? t.holder.ticketCode ?? ''}</div>
                    </TableCell>
                    <TableCell className="text-right font-semibold">{fmtR(t.balance)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={STATUS_META[t.status].className}>
                        {STATUS_META[t.status].label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <TagDetailSheet eventId={eventId} walletId={openTag} onClose={() => setOpenTag(null)} />
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold mt-1">{value}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>
      </CardContent>
    </Card>
  );
}
