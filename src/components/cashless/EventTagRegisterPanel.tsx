import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Nfc, Plus, Search, Trash2 } from 'lucide-react';
import { apiClient, type EventTagRow, type EventTagStatus } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const fmtWhen = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('en-ZA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

/** One uid per line, or comma/space separated — however the supplier sent the list. */
const splitUids = (raw: string): string[] =>
  raw.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);

/**
 * The event's TAG REGISTER — the physical tags this organizer has enrolled into
 * this show.
 *
 * This is the list that decides who gets in with a tag: a tag missing from here
 * cannot be bound to a ticket, so one bought elsewhere, or left over from
 * another event, buys nothing at this one. Tags normally land here by being
 * tapped on the POS at the Register desk; the paste box is for an organizer who
 * got a uid list with their tag order and would rather not tap 500 of them.
 */
export function EventTagRegisterPanel({ eventId }: { eventId: string }) {
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [uidText, setUidText] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<EventTagStatus | 'all'>('all');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['event-tag-registry', eventId, q, status],
    queryFn: () => apiClient.tags.registry(eventId, {
      ...(q.trim() ? { q: q.trim() } : {}),
      ...(status !== 'all' ? { status } : {}),
    }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['event-tag-registry', eventId] });

  const registerMany = useMutation({
    mutationFn: () => apiClient.tags.registerMany(eventId, splitUids(uidText)),
    onSuccess: (res) => {
      invalidate();
      const added = res.registered.length + res.reactivated.length;
      // Never a bare "done": the operator needs to know which of their lines
      // did nothing, and which the server would not take at all.
      const parts = [`${added} tag${added === 1 ? '' : 's'} registered`];
      if (res.alreadyRegistered.length) parts.push(`${res.alreadyRegistered.length} already in the register`);
      if (res.rejected.length) parts.push(`${res.rejected.length} rejected`);
      if (res.rejected.length) {
        toast.warning(parts.join(' · '), {
          description: res.rejected.slice(0, 5).map((r) => `${r.bandUid}: ${r.reason}`).join('\n'),
        });
      } else {
        toast.success(parts.join(' · '));
      }
      setIsAddOpen(false);
      setUidText('');
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to register the tags'),
  });

  const retire = useMutation({
    mutationFn: (bandUid: string) => apiClient.tags.retire(eventId, bandUid, 'Retired from the dashboard'),
    onSuccess: () => { invalidate(); toast.success('Tag retired — it will no longer work at this event'); },
    onError: (e: Error) => toast.error(e.message || 'Failed to retire the tag'),
  });

  const counts = data?.counts;
  const tags = data?.tags ?? [];
  const uidCount = splitUids(uidText).length;

  return (
    <section className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">Your tags for this event</h3>
          <p className="text-sm text-muted-foreground">
            Only tags registered here work at this event. Anything else — a tag from another event, or one
            someone brought themselves — is refused at the desk.
          </p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-orange-600 to-amber-600 text-white hover:opacity-90 shrink-0">
              <Plus className="h-4 w-4 mr-1.5" /> Register tags
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Register tags to this event</DialogTitle></DialogHeader>
            <form
              onSubmit={(e) => { e.preventDefault(); if (uidCount) registerMany.mutate(); }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="tag-uids">Tag IDs</Label>
                <Textarea
                  id="tag-uids"
                  value={uidText}
                  onChange={(e) => setUidText(e.target.value)}
                  rows={8}
                  className="font-mono text-sm"
                  placeholder={'04a22b1c\n04a22b1d\n04a22b1e'}
                />
                <p className="text-xs text-muted-foreground">
                  One per line (commas and spaces work too). Your desk staff can also just tap each tag on the
                  POS app — this box is for when the list came with your tag order.
                </p>
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-muted-foreground">
                  {uidCount} tag{uidCount === 1 ? '' : 's'} to register
                </span>
                <div className="flex space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={registerMany.isPending || !uidCount}
                    className="bg-gradient-to-r from-orange-600 to-amber-600 text-white hover:opacity-90">
                    {registerMany.isPending ? 'Registering…' : 'Register'}
                  </Button>
                </div>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Tabs value={status} onValueChange={(v) => setStatus(v as EventTagStatus | 'all')}>
          <TabsList>
            <TabsTrigger value="all">All{counts ? ` (${counts.total})` : ''}</TabsTrigger>
            <TabsTrigger value="active">In circulation{counts ? ` (${counts.active})` : ''}</TabsTrigger>
            <TabsTrigger value="retired">Retired{counts ? ` (${counts.retired})` : ''}</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative w-full sm:w-64 sm:ml-auto">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search tag ID" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-4">Loading the tag register…</p>
          ) : isError ? (
            <p className="text-sm text-red-600 py-4">
              Could not load the tag register
              {error instanceof Error && error.message ? ` — ${error.message}` : ''}.
            </p>
          ) : tags.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-12 gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-orange-500">
                <Nfc className="h-6 w-6" />
              </span>
              <p className="font-medium text-slate-700">
                {q.trim() || status !== 'all' ? 'No tag matches that' : 'No tags registered yet'}
              </p>
              {!q.trim() && status === 'all' && (
                <p className="text-sm text-slate-500 max-w-sm">
                  Until you register your tags, nobody can be given one at this event. Tap them in on the POS
                  app at the Register desk, or paste the list here.
                </p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tag ID</TableHead>
                    <TableHead>Registered by</TableHead>
                    <TableHead>When</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tags.map((t: EventTagRow) => (
                    <TableRow key={t.bandUid}>
                      <TableCell className="font-mono text-xs">
                        <span className="inline-flex items-center gap-1.5">
                          <Nfc className="h-3.5 w-3.5 text-orange-600" />
                          {t.bandUid}
                        </span>
                      </TableCell>
                      <TableCell>{t.registeredBy}</TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">{fmtWhen(t.registeredAt)}</TableCell>
                      <TableCell>
                        {t.status === 'active' ? (
                          <Badge variant="secondary" className="bg-green-100 text-green-800">In circulation</Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                            Retired{t.retiredReason ? ` — ${t.retiredReason}` : ''}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {t.status === 'active' && (
                          <Button variant="outline" size="sm"
                            disabled={retire.isPending && retire.variables === t.bandUid}
                            onClick={() => retire.mutate(t.bandUid)}
                            className="text-red-600 hover:text-red-700 hover:border-red-300">
                            <Trash2 className="h-4 w-4 mr-1.5" /> Retire
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {data && data.total > tags.length && (
                <p className="text-xs text-muted-foreground mt-3">
                  Showing {tags.length} of {data.total}. Narrow it down with the search box.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
