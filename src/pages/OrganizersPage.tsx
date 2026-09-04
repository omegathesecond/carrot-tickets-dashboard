import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Building2, BadgeCheck, Clock3, Ban } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import type { CreateOrganizerData, Organizer, OrganizerVerificationStatus } from '@/types';
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
import { TablePagination } from '@/components/TablePagination';

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

// Vendor "type" filter for the directory. 'events' covers organizers whose
// operatorType is events/transport/both (i.e. everything that isn't a
// service business) — the API doesn't take a combined param for that, so we
// pass no operatorType and filter services out client-side instead.
type TypeFilterValue = '' | 'events' | 'services';

const TYPE_FILTERS: { value: TypeFilterValue; label: string }[] = [
  { value: '', label: 'All types' },
  { value: 'events', label: 'Event organizers' },
  { value: 'services', label: 'Service businesses' },
];

function humanize(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const OPERATOR_TYPES: { value: CreateOrganizerData['operatorType']; label: string }[] = [
  { value: 'events', label: 'Event Organizer' },
  { value: 'transport', label: 'Bus Operator' },
  { value: 'both', label: 'Events & Bus' },
];

const EMPTY_CREATE_FORM: CreateOrganizerData = {
  businessName: '',
  operatorType: 'transport',
  email: '',
  phoneNumber: '',
  password: '',
  primaryContact: '',
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
  const [typeFilter, setTypeFilter] = useState<TypeFilterValue>('');
  const [page, setPage] = useState(1);

  // "Reject / suspend needs a reason" dialog state.
  const [reasonTarget, setReasonTarget] = useState<{ organizer: Organizer; status: OrganizerVerificationStatus } | null>(null);
  const [reason, setReason] = useState('');

  // "Add Operator" create dialog state.
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateOrganizerData>(EMPTY_CREATE_FORM);

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
    queryKey: ['organizers', search, status, typeFilter, page],
    queryFn: () =>
      apiClient.organizers.list({
        search,
        status: status || undefined,
        operatorType: typeFilter === 'services' ? 'services' : undefined,
        page,
        limit: PAGE_SIZE,
      }),
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

  const createOrganizer = useMutation({
    mutationFn: (data: CreateOrganizerData) => apiClient.organizers.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organizers'] });
      toast.success('Operator created');
      setCreateOpen(false);
      setCreateForm(EMPTY_CREATE_FORM);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Create failed'),
  });

  const submitCreateOrganizer = () => {
    const payload: CreateOrganizerData = {
      businessName: createForm.businessName.trim(),
      operatorType: createForm.operatorType,
      password: createForm.password,
    };
    if (createForm.email?.trim()) payload.email = createForm.email.trim();
    if (createForm.phoneNumber?.trim()) payload.phoneNumber = createForm.phoneNumber.trim();
    if (createForm.primaryContact?.trim()) payload.primaryContact = createForm.primaryContact.trim();
    createOrganizer.mutate(payload);
  };

  const canSubmitCreate =
    createForm.businessName.trim().length > 0 &&
    createForm.password.trim().length > 0 &&
    (!!createForm.email?.trim() || !!createForm.phoneNumber?.trim());

  const setVerificationStatus = (organizer: Organizer, next: OrganizerVerificationStatus) => {
    if (next === 'rejected' || next === 'suspended') {
      // Collect a reason first — it's shown back to the organizer.
      setReasonTarget({ organizer, status: next });
      setReason('');
      return;
    }
    verification.mutate({ id: organizer.id, status: next });
  };

  const rawOrganizers = data?.organizers ?? [];
  const organizers =
    typeFilter === 'events' ? rawOrganizers.filter((o) => o.operatorType !== 'services') : rawOrganizers;
  const pagination = data?.pagination;
  const counts = data?.statusCounts ?? {};
  const totalOrganizers = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Organizers</h1>
          <p className="text-sm text-slate-500">Organizer &amp; service-business accounts and their verification status.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>Add Operator</Button>
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
            <select
              aria-label="Filter by type"
              className="flex h-8 rounded-md border border-input bg-transparent px-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value as TypeFilterValue);
                setPage(1);
              }}
            >
              {TYPE_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
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
                      {search || status || typeFilter ? 'No organizers match your filters.' : 'No organizers yet.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  organizers.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell>
                        <div className="font-medium">{o.businessName}</div>
                        {o.operatorType === 'services' ? (
                          <Badge variant="outline" className="mt-1 bg-purple-100 text-purple-800 border-purple-200">
                            Service · {o.serviceCategory ? humanize(o.serviceCategory) : '—'}
                          </Badge>
                        ) : (
                          <div className="text-xs text-slate-500 capitalize">
                            {(o.businessType ?? '').replace(/_/g, ' ') || '—'}
                          </div>
                        )}
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

          <TablePagination
            page={pagination?.page ?? page}
            totalPages={pagination?.totalPages ?? 0}
            total={pagination?.total ?? 0}
            itemLabel="organizer"
            onPageChange={setPage}
            busy={isLoading}
          />
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

      {/* Add Operator create dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setCreateForm(EMPTY_CREATE_FORM);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Operator</DialogTitle>
            <DialogDescription>
              Create a new organizer account. Bus operators get the transport dashboard on login.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="create-business-name">Business name</Label>
              <Input
                id="create-business-name"
                value={createForm.businessName}
                onChange={(e) => setCreateForm({ ...createForm, businessName: e.target.value })}
                placeholder="e.g. Sunshine Coaches"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-operator-type">Operator type</Label>
              <select
                id="create-operator-type"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={createForm.operatorType}
                onChange={(e) =>
                  setCreateForm({ ...createForm, operatorType: e.target.value as CreateOrganizerData['operatorType'] })
                }
              >
                {OPERATOR_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-email">Email</Label>
              <Input
                id="create-email"
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                placeholder="operator@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-phone">Phone number</Label>
              <Input
                id="create-phone"
                value={createForm.phoneNumber}
                onChange={(e) => setCreateForm({ ...createForm, phoneNumber: e.target.value })}
                placeholder="e.g. +26876543210"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-primary-contact">Primary contact (optional)</Label>
              <Input
                id="create-primary-contact"
                value={createForm.primaryContact}
                onChange={(e) => setCreateForm({ ...createForm, primaryContact: e.target.value })}
                placeholder="e.g. Jane Dlamini"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-password">Password</Label>
              <Input
                id="create-password"
                type="password"
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={createOrganizer.isPending}>
              Cancel
            </Button>
            <Button onClick={submitCreateOrganizer} disabled={!canSubmitCreate || createOrganizer.isPending}>
              {createOrganizer.isPending ? 'Creating…' : 'Create operator'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
