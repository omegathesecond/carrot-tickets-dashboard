import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { ArrowLeft, DollarSign, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { type ResellerHub, type ResellerSettlement, type ResellerSettlementPreview } from '@/types';
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
import { DateRangePicker, type DateRange } from '@/components/DateRangePicker';

// ─── Hubs Tab ────────────────────────────────────────────────────────────────

function HubsTab({ resellerId }: { resellerId: string }) {
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
              <TableRow key={hub._id}>
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

// ─── Operators Tab ───────────────────────────────────────────────────────────

function OperatorsTab({ resellerId }: { resellerId: string }) {
  const queryClient = useQueryClient();
  const [selectedHubId, setSelectedHubId] = useState<string>('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    phoneNumber: '',
    email: '',
    password: '',
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
        password: form.password,
        role: form.role,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operators', selectedHubId] });
      toast.success(`Operator created. Temp password: ${form.password}`, { duration: 10000 });
      setIsAddOpen(false);
      setForm({ fullName: '', phoneNumber: '', email: '', password: '', role: 'reseller_operator' });
    },
    onError: (error: any) => toast.error(error.message || 'Failed to create operator'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName.trim() || !form.password.trim()) return;
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
                  <Label htmlFor="op-password">Temporary Password *</Label>
                  <Input
                    id="op-password"
                    type="text"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder="Temp password to hand to operator"
                    required
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
                    disabled={createOperator.isPending || !form.fullName.trim() || !form.password.trim()}
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
              <TableHead>Contact</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Password</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {operators.map((op) => (
              <TableRow key={op._id}>
                <TableCell className="font-medium">{op.fullName}</TableCell>
                <TableCell className="text-slate-600">
                  {op.phoneNumber || op.email || '—'}
                </TableCell>
                <TableCell className="text-slate-600">{op.role}</TableCell>
                <TableCell>
                  {op.mustChangePassword && (
                    <Badge variant="secondary">Must change password</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
              value={`E ${preview.cashOwedToCarrot.toFixed(2)}`}
              description="Cash collected by reseller due to Carrot"
              icon={Wallet}
              gradient="from-red-500 to-rose-600"
            />
            <StatsCard
              title="Commission Owed by Carrot"
              value={`E ${preview.commissionOwedByCarrot.toFixed(2)}`}
              description="Commission Carrot owes the reseller"
              icon={TrendingUp}
              gradient="from-green-500 to-emerald-600"
            />
            <StatsCard
              title="Net Amount"
              value={`E ${preview.netAmount.toFixed(2)}`}
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
                      <span className="font-medium">E {amount.toFixed(2)}</span>
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

export function ResellerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [commissionInput, setCommissionInput] = useState('');

  const { data: reseller, isLoading, isError: resellerError } = useQuery({
    queryKey: ['reseller', id],
    queryFn: () => apiClient.resellerAdmin.getReseller(id!),
    enabled: !!id,
  });

  useEffect(() => {
    if (resellerError) toast.error('Failed to load reseller');
  }, [resellerError]);

  const updateCommission = useMutation({
    mutationFn: () =>
      apiClient.resellerAdmin.updateReseller(id!, {
        commissionPercent: commissionInput === '' ? null : parseFloat(commissionInput),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reseller', id] });
      queryClient.invalidateQueries({ queryKey: ['resellers'] });
      toast.success('Commission updated');
      setCommissionInput('');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to update commission'),
  });

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
              </div>
              {reseller.email && <p className="text-slate-500 text-sm mt-1">{reseller.email}</p>}
              {reseller.phoneNumber && <p className="text-slate-500 text-sm">{reseller.phoneNumber}</p>}
            </div>

            {/* Edit commission */}
            <div className="flex items-end space-x-2">
              <div className="space-y-1">
                <Label htmlFor="commission-edit" className="text-xs text-slate-500">
                  Commission %{' '}
                  <span className="text-slate-400">
                    (current: {reseller.commissionPercent === null ? 'Platform default' : `${reseller.commissionPercent}%`})
                  </span>
                </Label>
                <Input
                  id="commission-edit"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  className="w-32"
                  placeholder="blank = default"
                  value={commissionInput}
                  onChange={(e) => setCommissionInput(e.target.value)}
                />
              </div>
              <Button
                onClick={() => updateCommission.mutate()}
                disabled={updateCommission.isPending}
                className="bg-gradient-to-r from-orange-600 to-amber-600 text-white hover:opacity-90"
              >
                {updateCommission.isPending ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="hubs">
        <TabsList>
          <TabsTrigger value="hubs">Hubs</TabsTrigger>
          <TabsTrigger value="operators">Operators</TabsTrigger>
          <TabsTrigger value="settlement">Settlement</TabsTrigger>
        </TabsList>

        <TabsContent value="hubs" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <HubsTab resellerId={id!} />
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
      </Tabs>
    </div>
  );
}
