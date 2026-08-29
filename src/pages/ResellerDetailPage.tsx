import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, type ResellerWithdrawal } from '@/lib/api';
import { toast } from 'sonner';
import { ArrowLeft, CalendarCheck, DollarSign, Globe, Pencil, TrendingDown, TrendingUp, Wallet, X } from 'lucide-react';
import { type Reseller, type ResellerHub, type ResellerSettlement, type ResellerSettlementPreview } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatsCard } from '@/components/ui/stats-card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { OperatorCredentialsDialog } from '@/components/OperatorCredentialsDialog';
import { DateRangePicker, type DateRange } from '@/components/DateRangePicker';
import { formatMoney } from '@/lib/currency';
import { formatEventDateTimeRange } from '@/lib/eventWhen';
import { EventPicker } from '@/components/EventPicker';

// ─── Hubs Tab ────────────────────────────────────────────────────────────────

function HubsTab({ resellerId }: { resellerId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState({ name: '', city: '', region: '' });

  const { data: hubs = [], isLoading, isError: hubsError } = useQuery({
    queryKey: ['hubs', resellerId],
    queryFn: () => apiClient.resellerAdmin.listHubs(resellerId),
  });

  useEffect(() => {
    if (hubsError) toast.error('Failed to load hubs');
  }, [hubsError]);

  const createHub = useMutation({
    mutationFn: () =>
      apiClient.resellerAdmin.createHub(resellerId, {
        name: form.name,
        location: { city: form.city || undefined, region: form.region || undefined },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hubs', resellerId] });
      toast.success('Hub created successfully');
      setIsAddOpen(false);
      setForm({ name: '', city: '', region: '' });
    },
    onError: (error: any) => toast.error(error.message || 'Failed to create hub'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    createHub.mutate();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-800">Hubs</h3>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-orange-600 to-amber-600 text-white hover:opacity-90">
              Add Hub
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Hub</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="hub-name">Hub Name *</Label>
                <Input
                  id="hub-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Main Street Hub"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hub-city">City (optional)</Label>
                <Input
                  id="hub-city"
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  placeholder="Mbabane"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hub-region">Region (optional)</Label>
                <Input
                  id="hub-region"
                  value={form.region}
                  onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
                  placeholder="Hhohho"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createHub.isPending || !form.name.trim()}
                  className="bg-gradient-to-r from-orange-600 to-amber-600 text-white hover:opacity-90"
                >
                  {createHub.isPending ? 'Creating…' : 'Create Hub'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-slate-500 text-sm py-4">Loading hubs…</p>
      ) : hubs.length === 0 ? (
        <p className="text-slate-500 text-sm py-4">No hubs yet. Add a hub to get started.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {hubs.map((hub) => (
              <TableRow
                key={hub._id}
                className="cursor-pointer hover:bg-slate-50"
                onClick={() => navigate(`/resellers/${resellerId}/hubs/${hub._id}`)}
              >
                <TableCell className="font-medium">{hub.name}</TableCell>
                <TableCell className="text-slate-600">
                  {hub.location?.city || hub.location?.region
                    ? [hub.location.city, hub.location.region].filter(Boolean).join(', ')
                    : '—'}
                </TableCell>
                <TableCell>
                  <Badge variant={hub.isActive ? 'default' : 'secondary'}>
                    {hub.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

// ─── Events Tab ──────────────────────────────────────────────────────────────

/**
 * Which events this reseller may see and sell.
 *
 * An EMPTY assignment means EVERY published event — the behaviour every
 * reseller had before assignment existed — so the empty state has to read as
 * "sells everything", not as an unfilled form.
 */
function EventsTab({ reseller }: { reseller: Reseller }) {
  const queryClient = useQueryClient();
  const assigned = reseller.eventIds ?? [];
  const [pendingClear, setPendingClear] = useState<string | null>(null);

  // Names/dates for the assigned ids. Fetched per event rather than through
  // the list endpoint: an assignment can name an event that has since been
  // unpublished, which a published-only list would silently drop from view.
  const details = useQueries({
    queries: assigned.map((eventId) => ({
      queryKey: ['event', eventId],
      queryFn: () => apiClient.events.getEvent(eventId),
    })),
  });

  const save = useMutation({
    mutationFn: (eventIds: string[]) =>
      apiClient.resellerAdmin.updateReseller(reseller._id, { eventIds }),
    onSuccess: (_data, eventIds) => {
      queryClient.invalidateQueries({ queryKey: ['reseller', reseller._id] });
      toast.success(
        eventIds.length === 0
          ? `${reseller.businessName} can now sell every event`
          : `${reseller.businessName} sells ${eventIds.length} event${eventIds.length === 1 ? '' : 's'}`,
      );
    },
    onError: (error: any) => toast.error(error.message || 'Failed to update the assignment'),
  });

  const remove = (eventId: string) => {
    const next = assigned.filter((id) => id !== eventId);
    // Removing the LAST event does not narrow the reseller — it widens them to
    // the whole catalogue. That inversion is too surprising to do on one click.
    if (next.length === 0) {
      setPendingClear(eventId);
      return;
    }
    save.mutate(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">Events this reseller can sell</h3>
          <p className="text-sm text-slate-500">
            {assigned.length === 0
              ? 'No restriction — every published event is available to their tills.'
              : 'Their tills see only these events. Everything else is hidden and refused.'}
          </p>
        </div>
        <div className="w-full sm:w-72">
          <EventPicker
            value={assigned}
            onChange={(eventIds) => save.mutate(eventIds)}
            disabled={save.isPending}
            placeholder={assigned.length === 0 ? 'Restrict to specific events…' : 'Assign another event…'}
          />
        </div>
      </div>

      {assigned.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-6 py-10 text-center">
          <Globe className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 font-medium text-slate-900">Sells every event</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
            This reseller can list and sell any published event on the platform. Assign one or
            more events above to restrict them.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
          {assigned.map((eventId, index) => {
            const query = details[index];
            const event = query?.data;
            return (
              <div key={eventId} className="flex items-center gap-3 bg-white p-3">
                {event?.posterUrl ? (
                  <img
                    src={event.posterUrl}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-md object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-slate-100">
                    <CalendarCheck className="h-5 w-5 text-slate-400" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  {query?.isLoading ? (
                    <p className="text-sm text-slate-400">Loading event…</p>
                  ) : event ? (
                    <>
                      <p className="truncate font-medium text-slate-900">{event.name}</p>
                      <div className="text-xs text-slate-500 sm:flex sm:gap-1">
                        <p className="truncate">{event.venue}</p>
                        <span className="hidden sm:inline">•</span>
                        <p className="truncate">{formatEventDateTimeRange(event)}</p>
                      </div>
                    </>
                  ) : (
                    // Never render a silent placeholder here: an id that no
                    // longer resolves is a real assignment pointing at nothing,
                    // and it silently costs the reseller a sellable event.
                    <>
                      <p className="truncate font-medium text-red-600">Event unavailable</p>
                      <p className="truncate font-mono text-xs text-slate-400">{eventId}</p>
                    </>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={save.isPending}
                  onClick={() => remove(eventId)}
                  aria-label={`Unassign ${event?.name ?? 'event'}`}
                  className="shrink-0 text-slate-400 hover:text-red-600"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={pendingClear !== null}
        onOpenChange={(open) => !open && setPendingClear(null)}
        title="Give this reseller every event?"
        description={`Removing the last assigned event does not restrict ${reseller.businessName} — it lets them see and sell every published event on the platform.`}
        confirmLabel="Yes, allow every event"
        isLoading={save.isPending}
        onConfirm={() => {
          save.mutate([]);
          setPendingClear(null);
        }}
      />
    </div>
  );
}

// ─── Operators Tab ───────────────────────────────────────────────────────────

function OperatorsTab({ resellerId }: { resellerId: string }) {
  const queryClient = useQueryClient();
  const [selectedHubId, setSelectedHubId] = useState<string>('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [issued, setIssued] = useState<{ title: string; loginCode?: string; pin: string } | null>(null);
  const [form, setForm] = useState({
    fullName: '',
    phoneNumber: '',
    email: '',
    role: 'reseller_operator',
  });

  const { data: hubs = [], isLoading: hubsLoading, isError: hubsLoadError } = useQuery({
    queryKey: ['hubs', resellerId],
    queryFn: () => apiClient.resellerAdmin.listHubs(resellerId),
  });

  useEffect(() => {
    if (hubsLoadError) toast.error('Failed to load hubs');
  }, [hubsLoadError]);

  const { data: operators = [], isLoading: opsLoading, isError: opsError } = useQuery({
    queryKey: ['operators', selectedHubId],
    queryFn: () => apiClient.resellerAdmin.listOperators(selectedHubId),
    enabled: !!selectedHubId,
  });

  useEffect(() => {
    if (opsError) toast.error('Failed to load operators');
  }, [opsError]);

  const createOperator = useMutation({
    mutationFn: () =>
      apiClient.resellerAdmin.createOperator(selectedHubId, {
        fullName: form.fullName,
        phoneNumber: form.phoneNumber || undefined,
        email: form.email || undefined,
        role: form.role,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['operators', selectedHubId] });
      toast.success('Operator created');
      setIssued({ title: 'Operator created', loginCode: res.loginCode, pin: res.pin });
      setIsAddOpen(false);
      setForm({ fullName: '', phoneNumber: '', email: '', role: 'reseller_operator' });
    },
    onError: (error: any) => toast.error(error.message || 'Failed to create operator'),
  });

  const resetPin = useMutation({
    mutationFn: (operatorId: string) => apiClient.resellerAdmin.resetOperatorPin(operatorId),
    onSuccess: (res) => setIssued({ title: 'PIN reset', pin: res.pin }),
    onError: (error: any) => toast.error(error.message || 'Failed to reset PIN'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName.trim()) return;
    createOperator.mutate();
  };

  if (hubsLoading) return <p className="text-slate-500 text-sm py-4">Loading hubs…</p>;

  if (hubs.length === 0) {
    return (
      <p className="text-slate-500 text-sm py-4">
        Add a hub first before adding operators.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center space-x-3">
          <Label htmlFor="hub-select">Hub</Label>
          <Select value={selectedHubId} onValueChange={setSelectedHubId}>
            <SelectTrigger id="hub-select" className="w-48">
              <SelectValue placeholder="Select hub…" />
            </SelectTrigger>
            <SelectContent>
              {hubs.map((hub) => (
                <SelectItem key={hub._id} value={hub._id}>
                  {hub.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedHubId && (
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-orange-600 to-amber-600 text-white hover:opacity-90">
                Add Operator
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Operator</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="op-fullname">Full Name *</Label>
                  <Input
                    id="op-fullname"
                    value={form.fullName}
                    onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                    placeholder="Jane Dlamini"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="op-phone">Phone Number (optional)</Label>
                  <Input
                    id="op-phone"
                    value={form.phoneNumber}
                    onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))}
                    placeholder="+268 7800 0000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="op-email">Email (optional)</Label>
                  <Input
                    id="op-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="jane@business.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="op-role">Role</Label>
                  <Select
                    value={form.role}
                    onValueChange={(val) => setForm((f) => ({ ...f, role: val }))}
                  >
                    <SelectTrigger id="op-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="reseller_operator">Operator</SelectItem>
                      <SelectItem value="reseller_manager">Manager</SelectItem>
                      <SelectItem value="reseller_admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end space-x-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createOperator.isPending || !form.fullName.trim()}
                    className="bg-gradient-to-r from-orange-600 to-amber-600 text-white hover:opacity-90"
                  >
                    {createOperator.isPending ? 'Creating…' : 'Create Operator'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {!selectedHubId ? (
        <p className="text-slate-500 text-sm py-4">Select a hub to view operators.</p>
      ) : opsLoading ? (
        <p className="text-slate-500 text-sm py-4">Loading operators…</p>
      ) : operators.length === 0 ? (
        <p className="text-slate-500 text-sm py-4">No operators in this hub yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>User ID</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {operators.map((op) => (
              <TableRow key={op._id}>
                <TableCell className="font-medium">{op.fullName}</TableCell>
                <TableCell className="font-mono">{op.loginCode}</TableCell>
                <TableCell className="text-slate-600">{op.phoneNumber || op.email || '—'}</TableCell>
                <TableCell className="text-slate-600">{op.role}</TableCell>
                <TableCell>
                  <Badge variant={op.isActive ? 'default' : 'secondary'}>
                    {op.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" disabled={resetPin.isPending}
                    onClick={() => resetPin.mutate(op._id)}>
                    Reset PIN
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {issued && (
        <OperatorCredentialsDialog
          open={!!issued}
          onClose={() => setIssued(null)}
          title={issued.title}
          loginCode={issued.loginCode}
          pin={issued.pin}
        />
      )}
    </div>
  );
}

// ─── Settlement Tab ──────────────────────────────────────────────────────────

function SettlementTab({ resellerId }: { resellerId: string }) {
  const [dateRange, setDateRange] = useState<DateRange>({ startDate: undefined, endDate: undefined });
  const [preview, setPreview] = useState<ResellerSettlementPreview | null>(null);
  const [settlement, setSettlement] = useState<ResellerSettlement | null>(null);
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);
  const [paymentRef, setPaymentRef] = useState('');

  const previewMutation = useMutation({
    mutationFn: () =>
      apiClient.resellerAdmin.getResellerSettlement(resellerId, dateRange.startDate!, dateRange.endDate!),
    onSuccess: (data) => {
      setPreview(data);
      setSettlement(null);
    },
    onError: (error: any) => toast.error(error.message || 'Failed to load settlement preview'),
  });

  const closeMutation = useMutation({
    mutationFn: () =>
      apiClient.resellerAdmin.closeResellerSettlement(resellerId, dateRange.startDate!, dateRange.endDate!),
    onSuccess: (data) => {
      setSettlement(data);
      toast.success('Settlement period closed');
      setIsCloseConfirmOpen(false);
    },
    onError: (error: any) => toast.error(error.message || 'Failed to close settlement'),
  });

  const markPaidMutation = useMutation({
    mutationFn: () =>
      apiClient.resellerAdmin.markResellerSettlementPaid(
        resellerId,
        settlement!._id,
        paymentRef || undefined,
      ),
    onSuccess: (data) => {
      setSettlement(data);
      toast.success('Settlement marked as paid');
      setPaymentRef('');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to mark as paid'),
  });

  const canPreview = !!dateRange.startDate && !!dateRange.endDate;

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <DateRangePicker value={dateRange} onChange={setDateRange} />
        <Button
          onClick={() => previewMutation.mutate()}
          disabled={!canPreview || previewMutation.isPending}
          className="bg-gradient-to-r from-orange-600 to-amber-600 text-white hover:opacity-90"
        >
          {previewMutation.isPending ? 'Loading…' : 'Preview'}
        </Button>
      </div>

      {preview && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatsCard
              title="Cash Owed to Carrot"
              value={formatMoney(preview.cashOwedToCarrot, 'SZL', { space: true, decimals: 2 })}
              description="Cash collected by reseller due to Carrot"
              icon={Wallet}
              gradient="from-red-500 to-rose-600"
            />
            <StatsCard
              title="Commission Owed by Carrot"
              value={formatMoney(preview.commissionOwedByCarrot, 'SZL', { space: true, decimals: 2 })}
              description="Commission Carrot owes the reseller"
              icon={TrendingUp}
              gradient="from-green-500 to-emerald-600"
            />
            <StatsCard
              title="Net Amount"
              value={formatMoney(preview.netAmount, 'SZL', { space: true, decimals: 2 })}
              description="Net payable (positive = reseller owes Carrot)"
              icon={preview.netAmount >= 0 ? TrendingDown : TrendingUp}
              gradient="from-orange-500 to-amber-600"
            />
          </div>

          {Object.keys(preview.byMethod).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-slate-700">Breakdown by Payment Method</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {Object.entries(preview.byMethod).map(([method, amount]) => (
                    <li key={method} className="flex justify-between text-sm">
                      <span className="text-slate-600 capitalize">{method}</span>
                      <span className="font-medium">{formatMoney(amount, 'SZL', { space: true, decimals: 2 })}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {!settlement && (
            <Button
              variant="outline"
              onClick={() => setIsCloseConfirmOpen(true)}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              Close Period
            </Button>
          )}
        </div>
      )}

      {settlement && settlement.status !== 'paid' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-slate-700">Mark Settlement as Paid</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-slate-600 text-sm">
              Settlement <span className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">{settlement._id}</span> is <Badge variant="secondary">{settlement.status}</Badge>
            </p>
            <div className="space-y-2">
              <Label htmlFor="payment-ref">Payment Reference (optional)</Label>
              <Input
                id="payment-ref"
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                placeholder="e.g. EFT-20260601"
              />
            </div>
            <Button
              onClick={() => markPaidMutation.mutate()}
              disabled={markPaidMutation.isPending}
              className="bg-gradient-to-r from-orange-600 to-amber-600 text-white hover:opacity-90"
            >
              {markPaidMutation.isPending ? 'Processing…' : 'Mark as Paid'}
            </Button>
          </CardContent>
        </Card>
      )}

      {settlement && settlement.status === 'paid' && (
        <Card>
          <CardContent className="pt-4">
            <p className="text-green-700 font-medium text-sm">
              Settlement marked as paid
              {settlement.paymentReference ? ` — ref: ${settlement.paymentReference}` : ''}.
            </p>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={isCloseConfirmOpen}
        onOpenChange={setIsCloseConfirmOpen}
        title="Close Settlement Period"
        description="This will lock the settlement period and create a formal settlement record. This cannot be undone."
        confirmLabel="Close Period"
        isLoading={closeMutation.isPending}
        onConfirm={() => closeMutation.mutate()}
        destructive
      />
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

type EditForm = {
  businessName: string;
  email: string;
  phoneNumber: string;
  commissionPercent: string;
  status: 'active' | 'suspended';
};

const WITHDRAWAL_BADGE: Record<ResellerWithdrawal['status'], string> = {
  requested: 'bg-amber-100 text-amber-800',
  approved: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

function WithdrawalsTab({ resellerId }: { resellerId: string }) {
  const queryClient = useQueryClient();
  const [payDialog, setPayDialog] = useState<ResellerWithdrawal | null>(null);
  const [reference, setReference] = useState('');

  const { data: withdrawals = [], isLoading, isError } = useQuery({
    queryKey: ['withdrawals', resellerId],
    queryFn: () => apiClient.resellerAdmin.listWithdrawals(resellerId),
  });

  useEffect(() => {
    if (isError) toast.error('Failed to load withdrawals');
  }, [isError]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['withdrawals', resellerId] });

  const approve = useMutation({
    mutationFn: (id: string) => apiClient.resellerAdmin.approveWithdrawal(id),
    onSuccess: () => { invalidate(); toast.success('Withdrawal approved'); },
    onError: (e: any) => toast.error(e.message || 'Failed to approve'),
  });

  const reject = useMutation({
    mutationFn: (id: string) => apiClient.resellerAdmin.rejectWithdrawal(id),
    onSuccess: () => { invalidate(); toast.success('Withdrawal rejected'); },
    onError: (e: any) => toast.error(e.message || 'Failed to reject'),
  });

  const markPaid = useMutation({
    mutationFn: ({ id, ref }: { id: string; ref: string }) =>
      apiClient.resellerAdmin.markWithdrawalPaid(id, ref.trim() || undefined),
    onSuccess: () => {
      invalidate();
      toast.success('Withdrawal marked paid');
      setPayDialog(null);
      setReference('');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to mark paid'),
  });

  if (isLoading) return <p className="text-slate-500">Loading withdrawals…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Wallet className="h-5 w-5 text-orange-600" />
        <h3 className="font-semibold text-slate-900">Commission Withdrawals</h3>
      </div>

      {withdrawals.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">No withdrawal requests.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Requested</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {withdrawals.map((w) => (
              <TableRow key={w._id}>
                <TableCell className="font-semibold tabular-nums">{formatMoney(w.amount, 'SZL', { space: true, decimals: 0 })}</TableCell>
                <TableCell>
                  <Badge className={WITHDRAWAL_BADGE[w.status]}>{w.status}</Badge>
                </TableCell>
                <TableCell className="text-slate-600">
                  {new Date(w.requestedAt).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-slate-600">{w.paymentReference ?? '—'}</TableCell>
                <TableCell className="text-right space-x-2">
                  {w.status === 'requested' && (
                    <>
                      <Button size="sm" variant="outline"
                        disabled={approve.isPending}
                        onClick={() => approve.mutate(w._id)}>Approve</Button>
                      <Button size="sm" variant="outline"
                        disabled={reject.isPending}
                        onClick={() => reject.mutate(w._id)}>Reject</Button>
                    </>
                  )}
                  {w.status === 'approved' && (
                    <>
                      <Button size="sm"
                        className="bg-gradient-to-r from-orange-600 to-amber-600 text-white hover:opacity-90"
                        onClick={() => { setPayDialog(w); setReference(''); }}>Mark paid</Button>
                      <Button size="sm" variant="outline"
                        disabled={reject.isPending}
                        onClick={() => reject.mutate(w._id)}>Reject</Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={!!payDialog} onOpenChange={(open) => !open && setPayDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark withdrawal paid</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (payDialog) markPaid.mutate({ id: payDialog._id, ref: reference });
            }}
            className="space-y-4"
          >
            <p className="text-sm text-slate-600">
              Paying out <span className="font-semibold">{payDialog ? formatMoney(payDialog.amount, 'SZL', { space: true, decimals: 0 }) : ''}</span>.
            </p>
            <div className="space-y-2">
              <Label htmlFor="wd-ref">Payment reference (optional)</Label>
              <Input id="wd-ref" value={reference} onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. MoMo TX id / bank ref" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setPayDialog(null)}>Cancel</Button>
              <Button type="submit" disabled={markPaid.isPending}
                className="bg-gradient-to-r from-orange-600 to-amber-600 text-white hover:opacity-90">
                {markPaid.isPending ? 'Saving…' : 'Confirm paid'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ResellerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [form, setForm] = useState<EditForm>({
    businessName: '',
    email: '',
    phoneNumber: '',
    commissionPercent: '',
    status: 'active',
  });

  const { data: reseller, isLoading, isError: resellerError } = useQuery({
    queryKey: ['reseller', id],
    queryFn: () => apiClient.resellerAdmin.getReseller(id!),
    enabled: !!id,
  });

  useEffect(() => {
    if (resellerError) toast.error('Failed to load reseller');
  }, [resellerError]);

  const openEdit = () => {
    if (!reseller) return;
    setForm({
      businessName: reseller.businessName,
      email: reseller.email ?? '',
      phoneNumber: reseller.phoneNumber ?? '',
      commissionPercent: reseller.commissionPercent === null ? '' : String(reseller.commissionPercent),
      status: reseller.status,
    });
    setIsEditOpen(true);
  };

  const updateReseller = useMutation({
    mutationFn: () =>
      apiClient.resellerAdmin.updateReseller(id!, {
        businessName: form.businessName.trim(),
        // Blank email/phone are omitted (left unchanged) — sending '' would
        // collide on the model's unique-sparse indexes.
        email: form.email.trim() || undefined,
        phoneNumber: form.phoneNumber.trim() || undefined,
        commissionPercent: form.commissionPercent === '' ? null : parseFloat(form.commissionPercent),
        status: form.status,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reseller', id] });
      queryClient.invalidateQueries({ queryKey: ['resellers'] });
      toast.success('Reseller updated');
      setIsEditOpen(false);
    },
    onError: (error: any) => toast.error(error.message || 'Failed to update reseller'),
  });

  // Tab is controlled so the header chip can jump straight to the assignment.
  const [tab, setTab] = useState('hubs');
  const assignedCount = reseller?.eventIds?.length ?? 0;

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.businessName.trim()) return;
    updateReseller.mutate();
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <p className="text-slate-500">Loading reseller…</p>
      </div>
    );
  }

  if (resellerError) {
    return (
      <div className="p-8">
        <p className="text-red-600">Failed to load reseller. Please try again.</p>
      </div>
    );
  }

  if (!reseller) {
    return (
      <div className="p-8">
        <p className="text-red-600">Reseller not found.</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Back link */}
      <Link
        to="/resellers"
        className="inline-flex items-center text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Resellers
      </Link>

      {/* Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-start gap-4 justify-between">
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-2xl font-bold text-slate-900">{reseller.businessName}</h1>
                <Badge variant={reseller.status === 'active' ? 'default' : 'destructive'}>
                  {reseller.status === 'active' ? 'Active' : 'Suspended'}
                </Badge>
                {/*
                  Scope is the first thing you need to know about a reseller and
                  the easiest to get wrong, so it reads at a glance instead of
                  living one tab click away.
                */}
                <button
                  type="button"
                  onClick={() => setTab('events')}
                  className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900"
                >
                  {assignedCount === 0 ? (
                    <Globe className="h-3.5 w-3.5" />
                  ) : (
                    <CalendarCheck className="h-3.5 w-3.5" />
                  )}
                  {assignedCount === 0
                    ? 'Sells all events'
                    : `Sells ${assignedCount} event${assignedCount === 1 ? '' : 's'}`}
                </button>
              </div>
              {reseller.email && <p className="text-slate-500 text-sm mt-1">{reseller.email}</p>}
              {reseller.phoneNumber && <p className="text-slate-500 text-sm">{reseller.phoneNumber}</p>}
            </div>

            {/* Reseller summary + edit */}
            <div className="flex flex-col items-end gap-2">
              <p className="text-xs text-slate-500">
                Commission:{' '}
                <span className="font-medium text-slate-700">
                  {reseller.commissionPercent === null
                    ? 'Platform default'
                    : `${reseller.commissionPercent}%`}
                </span>
              </p>
              <Button variant="outline" onClick={openEdit}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit Reseller
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit reseller dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Reseller</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-business-name">Business Name *</Label>
              <Input
                id="edit-business-name"
                value={form.businessName}
                onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))}
                placeholder="Acme Reseller"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="contact@business.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Phone Number</Label>
              <Input
                id="edit-phone"
                value={form.phoneNumber}
                onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))}
                placeholder="+268 7800 0000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-commission">
                Commission %{' '}
                <span className="text-slate-400 font-normal">(blank = platform default)</span>
              </Label>
              <Input
                id="edit-commission"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.commissionPercent}
                onChange={(e) => setForm((f) => ({ ...f, commissionPercent: e.target.value }))}
                placeholder="blank = default"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select
                value={form.status}
                onValueChange={(val) =>
                  setForm((f) => ({ ...f, status: val as 'active' | 'suspended' }))
                }
              >
                <SelectTrigger id="edit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateReseller.isPending || !form.businessName.trim()}
                className="bg-gradient-to-r from-orange-600 to-amber-600 text-white hover:opacity-90"
              >
                {updateReseller.isPending ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="hubs">Hubs</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="operators">Operators</TabsTrigger>
          <TabsTrigger value="settlement">Settlement</TabsTrigger>
          <TabsTrigger value="payouts">Payouts</TabsTrigger>
        </TabsList>

        <TabsContent value="hubs" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <HubsTab resellerId={id!} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <EventsTab reseller={reseller} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="operators" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <OperatorsTab resellerId={id!} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settlement" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <SettlementTab resellerId={id!} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payouts" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <WithdrawalsTab resellerId={id!} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
