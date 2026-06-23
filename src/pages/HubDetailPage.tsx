import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, DollarSign, Ticket, Receipt, Users } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { StatsCard } from '@/components/ui/stats-card';
import { DateRangePicker, type DateRange } from '@/components/DateRangePicker';
import { OperatorCredentialsDialog } from '@/components/OperatorCredentialsDialog';

export function HubDetailPage() {
  const { id, hubId } = useParams<{ id: string; hubId: string }>();
  const queryClient = useQueryClient();
  const [range, setRange] = useState<DateRange>({ startDate: undefined, endDate: undefined });
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState({ fullName: '', role: 'reseller_operator' });
  const [issued, setIssued] = useState<{ title: string; loginCode?: string; pin: string } | null>(null);

  const { data: hub } = useQuery({
    queryKey: ['hub', hubId],
    queryFn: () => apiClient.resellerAdmin.getHub(hubId!),
    enabled: !!hubId,
  });

  const { data: analytics } = useQuery({
    queryKey: ['hub-analytics', hubId, range.startDate, range.endDate],
    queryFn: () => apiClient.resellerAdmin.getHubAnalytics(hubId!, range.startDate, range.endDate),
    enabled: !!hubId,
  });

  const { data: operators = [] } = useQuery({
    queryKey: ['operators', hubId],
    queryFn: () => apiClient.resellerAdmin.listOperators(hubId!),
    enabled: !!hubId,
  });

  const createOperator = useMutation({
    mutationFn: () => apiClient.resellerAdmin.createOperator(hubId!, { fullName: form.fullName, role: form.role }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['operators', hubId] });
      queryClient.invalidateQueries({ queryKey: ['hub-analytics', hubId] });
      toast.success('Operator created');
      setIssued({ title: 'Operator created', loginCode: res.loginCode, pin: res.pin });
      setIsAddOpen(false);
      setForm({ fullName: '', role: 'reseller_operator' });
    },
    onError: (e: any) => toast.error(e.message || 'Failed to create operator'),
  });

  const resetPin = useMutation({
    mutationFn: (operatorId: string) => apiClient.resellerAdmin.resetOperatorPin(operatorId),
    onSuccess: (res) => setIssued({ title: 'PIN reset', pin: res.pin }),
    onError: (e: any) => toast.error(e.message || 'Failed to reset PIN'),
  });

  return (
    <div className="p-8 space-y-6">
      <Link to={`/resellers/${id}`} className="inline-flex items-center text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Reseller
      </Link>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{hub?.name ?? 'Hub'}</h1>
            {hub && (
              <Badge variant={hub.isActive ? 'default' : 'secondary'}>
                {hub.isActive ? 'Active' : 'Inactive'}
              </Badge>
            )}
          </div>
          {hub?.location && (hub.location.city || hub.location.region) && (
            <p className="text-slate-500 text-sm mt-1">
              {[hub.location.city, hub.location.region].filter(Boolean).join(', ')}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Analytics */}
      <div className="space-y-4">
        <DateRangePicker value={range} onChange={setRange} />
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <StatsCard title="Revenue" value={`E ${(analytics?.revenue ?? 0).toFixed(2)}`} description="Completed sales" icon={DollarSign} gradient="from-green-500 to-emerald-600" />
          <StatsCard title="Tickets Sold" value={analytics?.ticketsSold ?? 0} description="Tickets" icon={Ticket} gradient="from-orange-500 to-amber-600" />
          <StatsCard title="Sales" value={analytics?.salesCount ?? 0} description="Completed sales" icon={Receipt} gradient="from-blue-500 to-indigo-600" />
          <StatsCard title="Operators" value={analytics?.operatorsCount ?? 0} description="In this hub" icon={Users} gradient="from-purple-500 to-fuchsia-600" />
        </div>

        <Card>
          <CardContent className="pt-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Per-operator</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Operator</TableHead>
                  <TableHead>User ID</TableHead>
                  <TableHead className="text-right">Sales</TableHead>
                  <TableHead className="text-right">Tickets</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(analytics?.byOperator ?? []).map((o) => (
                  <TableRow key={o.operatorId}>
                    <TableCell className="font-medium">{o.fullName}</TableCell>
                    <TableCell className="font-mono">{o.loginCode}</TableCell>
                    <TableCell className="text-right">{o.salesCount}</TableCell>
                    <TableCell className="text-right">{o.ticketsSold}</TableCell>
                    <TableCell className="text-right">E {o.revenue.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Operators management */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-800">Operators</h3>
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-orange-600 to-amber-600 text-white hover:opacity-90">Add Operator</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Operator</DialogTitle></DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); if (form.fullName.trim()) createOperator.mutate(); }} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="hub-op-name">Full Name *</Label>
                    <Input id="hub-op-name" value={form.fullName} required onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hub-op-role">Role</Label>
                    <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
                      <SelectTrigger id="hub-op-role"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="reseller_operator">Operator</SelectItem>
                        <SelectItem value="reseller_hub_manager">Manager</SelectItem>
                        <SelectItem value="reseller_admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={createOperator.isPending || !form.fullName.trim()} className="bg-gradient-to-r from-orange-600 to-amber-600 text-white hover:opacity-90">
                      {createOperator.isPending ? 'Creating…' : 'Create'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {operators.length === 0 ? (
            <p className="text-slate-500 text-sm py-4">No operators in this hub yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>User ID</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {operators.map((op) => (
                  <TableRow key={op._id}>
                    <TableCell className="font-medium">{op.fullName}</TableCell>
                    <TableCell className="font-mono">{op.loginCode}</TableCell>
                    <TableCell className="text-slate-600">{op.role}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" disabled={resetPin.isPending} onClick={() => resetPin.mutate(op._id)}>
                        Reset PIN
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {issued && (
        <OperatorCredentialsDialog
          open={!!issued}
          onClose={() => setIssued(null)}
          title={issued.title}
          loginCode={issued.loginCode}
          pin={issued.pin}
          businessName={hub?.name}
          hubName={hub?.name}
        />
      )}
    </div>
  );
}
