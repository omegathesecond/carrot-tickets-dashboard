import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Nfc, Search } from 'lucide-react';
import { apiClient, type TagRow, type TagStatus } from '@/lib/api';
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
 * The tags issued at one cashless event. A "tag" is really the wallet behind
 * it — the plastic carries only a UID, and the wallet is what survives a lost
 * tag being reissued, so rows are keyed and opened by walletId.
 */
export function EventTagsPanel({ eventId }: { eventId: string }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<TagStatus | 'all'>('all');
  const [openTag, setOpenTag] = useState<string | null>(null);

  const { data: summary } = useQuery({
    queryKey: ['tag-summary', eventId],
    queryFn: () => apiClient.tags.summary(eventId),
  });

  const { data: page, isLoading } = useQuery({
    queryKey: ['tags', eventId, status, q],
    queryFn: () => apiClient.tags.list(eventId, {
      ...(status !== 'all' ? { status } : {}),
      ...(q.trim() ? { q: q.trim() } : {}),
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
      </div>

      <Card>
        <CardContent className="pt-6 overflow-x-auto">
          {isLoading ? (
            <p className="py-8 text-center text-muted-foreground">Loading tags…</p>
          ) : !page?.tags.length ? (
            <p className="py-8 text-center text-muted-foreground">No tags issued yet.</p>
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
