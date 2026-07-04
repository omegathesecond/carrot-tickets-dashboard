import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Building2, BadgeCheck, Clock3, Ban } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import type { Organizer, OrganizerVerificationStatus } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatsCard } from '@/components/ui/stats-card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatCurrency } from '@/lib/chartColors';

const PAGE_SIZE = 25;

const STATUS_FILTERS: { value: '' | OrganizerVerificationStatus; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'verified', label: 'Verified' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'suspended', label: 'Suspended' },
];

const STATUS_BADGE: Record<OrganizerVerificationStatus, string> = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  verified: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
  suspended: 'bg-slate-200 text-slate-700 border-slate-300',
};

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function OrganizersPage() {
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'' | OrganizerVerificationStatus>('');
  const [page, setPage] = useState(1);

  // "Reject / suspend needs a reason" dialog state.
  const [reasonTarget, setReasonTarget] = useState<{ organizer: Organizer; status: OrganizerVerificationStatus } | null>(null);
  const [reason, setReason] = useState('');

  // Debounce the search box so we don't refetch on every keystroke, and reset
  // to page 1 whenever the query changes.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ['organizers', search, status, page],
    queryFn: () => apiClient.organizers.list({ search, status: status || undefined, page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const verification = useMutation({
    mutationFn: (params: { id: string; status: OrganizerVerificationStatus; rejectionReason?: string }) =>
      apiClient.organizers.updateVerification(params.id, {
        status: params.status,
        rejectionReason: params.rejectionReason,
      }),
    onSuccess: (_d, params) => {
      qc.invalidateQueries({ queryKey: ['organizers'] });
      toast.success(`Organizer ${params.status}`);
      setReasonTarget(null);
      setReason('');
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Update failed'),
  });

  const setVerificationStatus = (organizer: Organizer, next: OrganizerVerificationStatus) => {
    if (next === 'rejected' || next === 'suspended') {
      // Collect a reason first — it's shown back to the organizer.
      setReasonTarget({ organizer, status: next });
      setReason('');
      return;
    }
    verification.mutate({ id: organizer.id, status: next });
  };

  const organizers = data?.organizers ?? [];
  const pagination = data?.pagination;
  const counts = data?.statusCounts ?? {};
  const totalOrganizers = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Organizers</h1>
        <p className="text-sm text-slate-500">Event organizer accounts and their verification status.</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total organizers"
          value={isLoading && !data ? '—' : totalOrganizers.toLocaleString()}
          description="All registered organizer accounts"
          icon={Building2}
          gradient="from-orange-500 to-orange-600"
        />
        <StatsCard
          title="Verified"
          value={isLoading && !data ? '—' : (counts.verified ?? 0).toLocaleString()}
          description="Can publish events"
          icon={BadgeCheck}
          gradient="from-emerald-500 to-emerald-600"
        />
        <StatsCard
          title="Pending review"
          value={isLoading && !data ? '—' : (counts.pending ?? 0).toLocaleString()}
          description="Awaiting admin verification"
          icon={Clock3}
          gradient="from-amber-500 to-amber-600"
        />
        <StatsCard
          title="Rejected / suspended"
          value={isLoading && !data ? '—' : ((counts.rejected ?? 0) + (counts.suspended ?? 0)).toLocaleString()}
          description="Blocked from going live"
          icon={Ban}
          gradient="from-slate-500 to-slate-600"
        />
      </div>

      {/* Organizers table */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>All organizers</CardTitle>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex flex-wrap gap-1">
              {STATUS_FILTERS.map((f) => (
                <Button
                  key={f.label}
                  size="sm"
                  variant={status === f.value ? 'default' : 'outline'}
                  onClick={() => {
                    setStatus(f.value);
                    setPage(1);
                  }}
                >
                  {f.label}
                </Button>
              ))}
            </div>
            <Input
              placeholder="Search name, email or phone…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="sm:max-w-xs"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Events</TableHead>
                  <TableHead className="text-right">Tickets</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && !data ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-slate-500 py-8">Loading…</TableCell>
                  </TableRow>
                ) : organizers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-slate-500 py-8">
                      {search || status ? 'No organizers match your filters.' : 'No organizers yet.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  organizers.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell>
                        <div className="font-medium">{o.businessName}</div>
                        <div className="text-xs text-slate-500 capitalize">
                          {(o.businessType ?? '').replace(/_/g, ' ') || '—'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{o.primaryContact || '—'}</div>
                        <div className="text-xs text-slate-500">{o.email || o.phoneNumber || '—'}</div>
                      </TableCell>
                      <TableCell>{formatDate(o.createdAt)}</TableCell>
                      <TableCell className="text-right">{o.eventCount}</TableCell>
                      <TableCell className="text-right">{o.ticketsSold}</TableCell>
                      <TableCell className="text-right">{formatCurrency(o.revenue)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`capitalize ${STATUS_BADGE[o.verificationStatus]}`}>
                          {o.verificationStatus}
                        </Badge>
                        {o.rejectionReason && (
                          <div className="text-xs text-slate-500 mt-1 max-w-[180px] truncate" title={o.rejectionReason}>
                            {o.rejectionReason}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" disabled={verification.isPending}>
                              Actions
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {o.verificationStatus !== 'verified' && (
                              <DropdownMenuItem onClick={() => setVerificationStatus(o, 'verified')}>
                                Verify
                              </DropdownMenuItem>
                            )}
                            {o.verificationStatus !== 'pending' && (
                              <DropdownMenuItem onClick={() => setVerificationStatus(o, 'pending')}>
                                Move to pending
                              </DropdownMenuItem>
                            )}
                            {o.verificationStatus !== 'rejected' && (
                              <DropdownMenuItem
                                className="text-red-600 focus:text-red-600"
                                onClick={() => setVerificationStatus(o, 'rejected')}
                              >
                                Reject
                              </DropdownMenuItem>
                            )}
                            {o.verificationStatus !== 'suspended' && (
                              <DropdownMenuItem
                                className="text-red-600 focus:text-red-600"
                                onClick={() => setVerificationStatus(o, 'suspended')}
                              >
                                Suspend
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {pagination && pagination.total > 0 && (
            <div className="flex items-center justify-between pt-4 text-sm text-slate-500">
              <span>
                Page {pagination.page} of {pagination.totalPages} · {pagination.total.toLocaleString()} organizers
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || isLoading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pagination.totalPages || isLoading}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reject / suspend reason dialog */}
      <Dialog open={!!reasonTarget} onOpenChange={(open) => !open && setReasonTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="capitalize">
              {reasonTarget?.status === 'rejected' ? 'Reject' : 'Suspend'} {reasonTarget?.organizer.businessName}
            </DialogTitle>
            <DialogDescription>
              {reasonTarget?.status === 'rejected'
                ? 'The organizer stays signed in but cannot publish events.'
                : 'Suspension blocks this organizer from publishing events.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="verification-reason">Reason (optional)</Label>
            <Textarea
              id="verification-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              placeholder="e.g. Business registration documents missing"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReasonTarget(null)} disabled={verification.isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={verification.isPending}
              onClick={() =>
                reasonTarget &&
                verification.mutate({
                  id: reasonTarget.organizer.id,
                  status: reasonTarget.status,
                  rejectionReason: reason.trim() || undefined,
                })
              }
            >
              {verification.isPending
                ? 'Saving…'
                : reasonTarget?.status === 'rejected'
                  ? 'Reject organizer'
                  : 'Suspend organizer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
