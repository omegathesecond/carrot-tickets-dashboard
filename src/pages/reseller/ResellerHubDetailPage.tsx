import { useState } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, DollarSign, Ticket, Receipt, Users } from 'lucide-react';
import { useResellerAuth } from '@/contexts/ResellerAuthContext';
import { resellerHubsApi, resellerOperatorsApi } from '@/lib/resellerApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { StatsCard } from '@/components/ui/stats-card';
import { DateRangePicker, type DateRange } from '@/components/DateRangePicker';
import { OperatorCredentialsDialog } from '@/components/OperatorCredentialsDialog';

const HUB_VIEW_ROLES = ['reseller_admin', 'reseller_hub_manager'];

export function ResellerHubDetailPage() {
  const { hubId } = useParams<{ hubId: string }>();
  const { operator } = useResellerAuth();
  const queryClient = useQueryClient();
  const [range, setRange] = useState<DateRange>({ startDate: undefined, endDate: undefined });
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [issued, setIssued] = useState<{ title: string; loginCode?: string; pin: string } | null>(null);

  const { data: hub } = useQuery({ queryKey: ['portal-hub', hubId], queryFn: () => resellerHubsApi.get(hubId!), enabled: !!hubId });
  const { data: analytics } = useQuery({
    queryKey: ['portal-hub-analytics', hubId, range.startDate, range.endDate],
    queryFn: () => resellerHubsApi.analytics(hubId!, range.startDate, range.endDate),
    enabled: !!hubId,
  });
  const { data: operators = [] } = useQuery({
    queryKey: ['portal-hub-operators', hubId],
    queryFn: () => resellerOperatorsApi.list(hubId),
    enabled: !!hubId,
  });

  const canManage = operator?.role === 'reseller_admin' || operator?.role === 'reseller_hub_manager';

  const createOperator = useMutation({
    mutationFn: () => resellerOperatorsApi.create({ fullName, role: 'reseller_operator', hubId }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['portal-hub-operators', hubId] });
      queryClient.invalidateQueries({ queryKey: ['portal-hub-analytics', hubId] });
      toast.success('Operator created');
      setIssued({ title: 'Operator created', loginCode: res.loginCode, pin: res.pin });
      setIsAddOpen(false);
      setFullName('');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to create operator'),
  });

  const resetPin = useMutation({
    mutationFn: (id: string) => resellerOperatorsApi.resetPin(id),
    onSuccess: (res) => setIssued({ title: 'PIN reset', pin: res.pin }),
    onError: (e: any) => toast.error(e.message || 'Failed to reset PIN'),
  });

  if (operator && !HUB_VIEW_ROLES.includes(operator.role)) {
    return <Navigate to="/reseller" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-6">
      <Link to="/reseller/hubs" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Hubs
      </Link>
      <h1 className="text-2xl font-bold text-slate-900">{hub?.name ?? 'Hub'}</h1>

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

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-800">Operators</h3>
            {canManage && (
              <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-orange-600 to-amber-600 text-white hover:opacity-90">Add Operator</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Operator</DialogTitle></DialogHeader>
                  <form onSubmit={(e) => { e.preventDefault(); if (fullName.trim()) createOperator.mutate(); }} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="p-op-name">Full Name *</Label>
                      <Input id="p-op-name" value={fullName} required onChange={(e) => setFullName(e.target.value)} />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                      <Button type="submit" disabled={createOperator.isPending || !fullName.trim()} className="bg-gradient-to-r from-orange-600 to-amber-600 text-white hover:opacity-90">
                        {createOperator.isPending ? 'Creating…' : 'Create'}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            )}
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
                  {canManage && <TableHead></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {operators.map((op) => (
                  <TableRow key={op._id}>
                    <TableCell className="font-medium">{op.fullName}</TableCell>
                    <TableCell className="font-mono">{op.loginCode}</TableCell>
                    <TableCell className="text-slate-600">{op.role}</TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" disabled={resetPin.isPending} onClick={() => resetPin.mutate(op._id)}>
                          Reset PIN
                        </Button>
                      </TableCell>
                    )}
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
