import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Building2, BadgeCheck, Clock3, Ban } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import type {
  CreateOrganizerData,
  Organizer,
  OrganizerSort,
  OrganizerVenueTrading,
  OrganizerVerificationStatus,
  VenueStatus,
} from '@/types';
import { currencyLabel, type Currency } from '@/lib/currency';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { StatsCard } from '@/components/ui/stats-card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TablePagination } from '@/components/TablePagination';
import { OrganizerFilters } from '@/components/organizers/OrganizerFilters';
import { OrganizerTypeTabs } from '@/components/organizers/OrganizerTypeTabs';
import { OrganizersTable } from '@/components/organizers/OrganizersTable';
import type { OrganizerRowActions } from '@/components/organizers/OrganizerActionsMenu';
import { parseOrganizerTab, type OrganizerTab } from '@/components/organizers/organizerModel';

const PAGE_SIZE = 25;

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

export function OrganizersPage() {
  const qc = useQueryClient();
  // The open tab lives in ?type= so a refresh or a shared link keeps it.
  const [params, setParams] = useSearchParams();
  const tab = parseOrganizerTab(params.get('type'));
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'' | OrganizerVerificationStatus>('');
  const [sort, setSort] = useState<OrganizerSort>('newest');
  const [venueTrading, setVenueTrading] = useState<'' | OrganizerVenueTrading>('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);

  // Venue trading and Category only exist on one tab each (the API refuses
  // them anywhere else), so a tab change — click, back/forward or a pasted
  // link — clears both and goes back to page 1. Reset during render, before
  // any query is built from the stale values.
  const [filtersTab, setFiltersTab] = useState<OrganizerTab>(tab);
  if (filtersTab !== tab) {
    setFiltersTab(tab);
    setVenueTrading('');
    setCategory('');
    setPage(1);
  }

  // "Reject / suspend needs a reason" dialog state.
  const [reasonTarget, setReasonTarget] = useState<{ organizer: Organizer; status: OrganizerVerificationStatus } | null>(null);
  const [reason, setReason] = useState('');

  // "Add Operator" create dialog state.
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateOrganizerData>(EMPTY_CREATE_FORM);

  // "Switch on venue trading" dialog state.
  const [venueTarget, setVenueTarget] = useState<Organizer | null>(null);
  const [venueName, setVenueName] = useState('');
  const [venueCurrency, setVenueCurrency] = useState<Currency>('SZL');

  // Debounce the search box so we don't refetch on every keystroke, and reset
  // to page 1 whenever the query changes.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Every filter is applied by the server.
  const { data, isLoading, isPlaceholderData, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['organizers', tab, search, status, venueTrading, category, sort, page],
    queryFn: () =>
      apiClient.organizers.list({
        search,
        status: status || undefined,
        type: tab === 'all' ? undefined : tab,
        venueTrading: venueTrading || undefined,
        category: category || undefined,
        sort,
        page,
        limit: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  // The previous response stays up while the next page or filter loads, but
  // not across a tab change: another tab has other columns and other counts,
  // and its rows would read "Not on yet" under Venue trading. Until this tab's
  // own response lands, only the tab-independent parts of `data` (the tab
  // counts and the service categories) are used. A failed request shows no
  // numbers either, even if an older response is still cached.
  const [dataTab, setDataTab] = useState<OrganizerTab>(tab);
  if (!isPlaceholderData && dataTab !== tab) setDataTab(tab);
  const tabData = isError || (isPlaceholderData && dataTab !== tab) ? undefined : data;

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

  // Both venue mutations refetch the list on success AND failure (onSettled):
  // the app turns refetchOnWindowFocus off, so after a refused switch-on (409)
  // or a stale suspend the row would otherwise keep offering an action the
  // server has just told us is wrong, until a reload.
  const activateVenue = useMutation({
    mutationFn: (p: { vendorId: string; name: string; currency: Currency }) => apiClient.organizers.activateVenue(p),
    onSuccess: (_d, p) => toast.success(`Venue trading switched on for ${p.name}`),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Switch-on failed'),
    // The dialog closes either way — on a failure the toast carries the reason
    // and the refetched row shows the truth, rather than leaving a stale form.
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['organizers'] });
      setVenueTarget(null);
    },
  });

  const setVenueStatus = useMutation({
    mutationFn: (p: { venueId: string; status: VenueStatus }) => apiClient.organizers.setVenueStatus(p.venueId, p.status),
    onSuccess: (_d, p) => toast.success(p.status === 'suspended' ? 'Venue trading suspended' : 'Venue trading reactivated'),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Update failed'),
    onSettled: () => qc.invalidateQueries({ queryKey: ['organizers'] }),
  });

  const openVenueSwitch = (o: Organizer) => {
    setVenueTarget(o);
    setVenueName(o.businessName);
    setVenueCurrency('SZL');
  };

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

  const organizers = tabData?.organizers ?? [];
  const pagination = tabData?.pagination;
  const counts = tabData?.statusCounts ?? {};
  const totalOrganizers = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);
  // No data yet (loading, or the request failed) is a dash, never a zero.
  const stat = (n: number) => (tabData ? n.toLocaleString() : '—');
  const filtered = !!(search || status || venueTrading || category) || tab !== 'all';

  const rowActions: OrganizerRowActions = {
    busy: verification.isPending || setVenueStatus.isPending,
    onVerification: setVerificationStatus,
    onVenueStatus: (venueId, next) => setVenueStatus.mutate({ venueId, status: next }),
    onSwitchOnVenue: openVenueSwitch,
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Organizers</h1>
          <p className="text-sm text-slate-500">Organizer &amp; service-business accounts and their verification status.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>Add Operator</Button>
      </div>

      <OrganizerTypeTabs
        value={tab}
        counts={data?.typeCounts}
        onChange={(next) => setParams(next === 'all' ? {} : { type: next })}
      >
        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Total organizers"
            value={stat(totalOrganizers)}
            description="All registered organizer accounts"
            icon={Building2}
            gradient="from-orange-500 to-orange-600"
          />
          <StatsCard
            title="Verified"
            value={stat(counts.verified ?? 0)}
            description="Can publish events"
            icon={BadgeCheck}
            gradient="from-emerald-500 to-emerald-600"
          />
          <StatsCard
            title="Pending review"
            value={stat(counts.pending ?? 0)}
            description="Awaiting admin verification"
            icon={Clock3}
            gradient="from-amber-500 to-amber-600"
          />
          <StatsCard
            title="Rejected / suspended"
            value={stat((counts.rejected ?? 0) + (counts.suspended ?? 0))}
            description="Blocked from going live"
            icon={Ban}
            gradient="from-slate-500 to-slate-600"
          />
        </div>

        {/* Organizers table */}
        <Card>
          <CardHeader>
            <OrganizerFilters
              tab={tab}
              status={status}
              onStatusChange={(next) => {
                setStatus(next);
                setPage(1);
              }}
              statusCounts={tabData?.statusCounts}
              venueTrading={venueTrading}
              onVenueTradingChange={(next) => {
                setVenueTrading(next);
                setPage(1);
              }}
              category={category}
              onCategoryChange={(next) => {
                setCategory(next);
                setPage(1);
              }}
              serviceCategories={data?.serviceCategories ?? []}
              searchInput={searchInput}
              onSearchInputChange={setSearchInput}
            />
          </CardHeader>
          <CardContent>
            {isError ? (
              <div role="alert" className="py-8 text-center space-y-3">
                <p className="font-medium text-slate-900">Couldn't load organizers</p>
                <p className="text-sm text-slate-500">{error instanceof Error ? error.message : 'Something went wrong.'}</p>
                <Button onClick={() => refetch()} disabled={isFetching}>Try again</Button>
              </div>
            ) : (
              <>
                <OrganizersTable
                  tab={tab}
                  organizers={organizers}
                  loading={!tabData}
                  emptyMessage={filtered ? 'No organizers match your filters.' : 'No organizers yet.'}
                  sort={sort}
                  onSortChange={(next) => {
                    setSort(next);
                    setPage(1);
                  }}
                  actions={rowActions}
                />
                <TablePagination
                  page={pagination?.page ?? page}
                  totalPages={pagination?.totalPages ?? 0}
                  total={pagination?.total ?? 0}
                  itemLabel="organizer"
                  onPageChange={setPage}
                  busy={isLoading}
                />
              </>
            )}
          </CardContent>
        </Card>
      </OrganizerTypeTabs>

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

      {/* Switch on venue trading */}
      <Dialog open={!!venueTarget} onOpenChange={(open) => !open && setVenueTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Switch on venue trading</DialogTitle>
            <DialogDescription>
              {venueTarget?.businessName} gets a Venue section in their dashboard. One venue per account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="venue-name">Venue name</Label>
              <Input id="venue-name" value={venueName} onChange={(e) => setVenueName(e.target.value)} maxLength={120} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="venue-currency">Currency</Label>
              <select
                id="venue-currency"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={venueCurrency}
                onChange={(e) => setVenueCurrency(e.target.value as Currency)}
              >
                <option value="SZL">{currencyLabel('SZL')} — SZL</option>
                <option value="ZAR">{currencyLabel('ZAR')} — ZAR</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVenueTarget(null)} disabled={activateVenue.isPending}>
              Cancel
            </Button>
            <Button
              disabled={activateVenue.isPending || !venueName.trim()}
              onClick={() =>
                venueTarget &&
                activateVenue.mutate({ vendorId: venueTarget.id, name: venueName.trim(), currency: venueCurrency })
              }
            >
              Switch on
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
