import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, KeyRound, Plus, Power, UserPlus } from 'lucide-react';
import { useResellerAuth } from '@/contexts/ResellerAuthContext';
import { resellerOperatorsApi } from '@/lib/resellerApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const MANAGER_ROLES = ['reseller_admin', 'reseller_hub_manager'];

const ROLE_LABELS: Record<string, string> = {
  reseller_admin: 'Admin',
  reseller_hub_manager: 'Hub Manager',
  reseller_operator: 'Operator',
};

const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?';

export function ResellerOperatorsPage() {
  const { operator } = useResellerAuth();
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState({ fullName: '', role: 'reseller_operator' });

  const { data: operators = [], isLoading } = useQuery({
    queryKey: ['portal-operators'],
    queryFn: () => resellerOperatorsApi.list(),
  });

  const createOperator = useMutation({
    mutationFn: () => resellerOperatorsApi.create({ fullName: form.fullName, role: form.role }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['portal-operators'] });
      toast.success(`Created. User ID: ${res.loginCode} · PIN: ${res.pin}`, { duration: 15000 });
      setIsAddOpen(false);
      setForm({ fullName: '', role: 'reseller_operator' });
    },
    onError: (e: any) => toast.error(e.message || 'Failed to create operator'),
  });

  const resetPin = useMutation({
    mutationFn: (id: string) => resellerOperatorsApi.resetPin(id),
    onSuccess: (res) => toast.success(`New PIN: ${res.pin}`, { duration: 15000 }),
    onError: (e: any) => toast.error(e.message || 'Failed to reset PIN'),
  });

  const setActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      resellerOperatorsApi.setActive(id, isActive),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ['portal-operators'] });
      toast.success(vars.isActive ? 'Operator activated' : 'Operator deactivated');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to update operator'),
  });

  // Only managers/admins reach this screen.
  if (operator && !MANAGER_ROLES.includes(operator.role)) {
    return <Navigate to="/reseller" replace />;
  }

  const pendingActiveId = setActive.isPending ? setActive.variables?.id : undefined;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <Link
          to="/reseller"
          className="inline-flex items-center text-sm text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to POS
        </Link>

        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Operators</h1>
            <p className="text-sm text-slate-500">
              {operators.length} {operators.length === 1 ? 'person' : 'people'} with portal access
            </p>
          </div>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-orange-600 to-amber-600 text-white hover:opacity-90">
                <Plus className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Add operator</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add operator</DialogTitle></DialogHeader>
              <form
                onSubmit={(e) => { e.preventDefault(); if (form.fullName.trim()) createOperator.mutate(); }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="op-name">Full name</Label>
                  <Input id="op-name" value={form.fullName} required className="h-12"
                    onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />
                </div>
                {operator?.role === 'reseller_admin' && (
                  <div className="space-y-2">
                    <Label htmlFor="op-role">Role</Label>
                    <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
                      <SelectTrigger id="op-role" className="h-12"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="reseller_operator">Operator</SelectItem>
                        <SelectItem value="reseller_hub_manager">Hub Manager</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="flex justify-end space-x-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={createOperator.isPending || !form.fullName.trim()}
                    className="bg-gradient-to-r from-orange-600 to-amber-600 text-white hover:opacity-90">
                    {createOperator.isPending ? 'Creating…' : 'Create'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <Card key={i}><CardContent className="h-40 animate-pulse bg-slate-100/60 rounded-xl" /></Card>
            ))}
          </div>
        ) : operators.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center text-center py-14 gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-orange-500">
                <UserPlus className="h-6 w-6" />
              </span>
              <p className="font-medium text-slate-700">No operators yet</p>
              <p className="text-sm text-slate-500 max-w-xs">
                Add an operator to give a team member their own User ID and PIN for selling at events.
              </p>
              <Button onClick={() => setIsAddOpen(true)}
                className="mt-1 bg-gradient-to-r from-orange-600 to-amber-600 text-white hover:opacity-90">
                <Plus className="h-4 w-4 mr-1.5" /> Add operator
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {operators.map((op) => (
              <Card key={op._id} className={op.isActive ? '' : 'opacity-75'}>
                <CardContent className="pt-5 flex flex-col gap-4 h-full">
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-white font-bold">
                      {initialsOf(op.fullName)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900 leading-tight truncate">{op.fullName}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{ROLE_LABELS[op.role] ?? op.role}</p>
                    </div>
                    <Badge variant={op.isActive ? 'default' : 'secondary'}>
                      {op.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>

                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">User ID</p>
                    <p className="font-mono text-sm text-slate-800">{op.loginCode}</p>
                  </div>

                  <div className="mt-auto grid grid-cols-2 gap-2">
                    <Button
                      variant="outline" size="sm"
                      disabled={resetPin.isPending}
                      onClick={() => resetPin.mutate(op._id)}
                    >
                      <KeyRound className="h-4 w-4 mr-1.5" /> Reset PIN
                    </Button>
                    <Button
                      variant="outline" size="sm"
                      disabled={pendingActiveId === op._id}
                      onClick={() => setActive.mutate({ id: op._id, isActive: !op.isActive })}
                      className={op.isActive
                        ? 'text-red-600 hover:text-red-700 hover:border-red-300'
                        : 'text-emerald-600 hover:text-emerald-700 hover:border-emerald-300'}
                    >
                      <Power className="h-4 w-4 mr-1.5" />
                      {op.isActive ? 'Disable' : 'Enable'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
