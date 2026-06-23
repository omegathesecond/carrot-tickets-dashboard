import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
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
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

const MANAGER_ROLES = ['reseller_admin', 'reseller_hub_manager'];

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

  // Only managers/admins reach this screen.
  if (operator && !MANAGER_ROLES.includes(operator.role)) {
    return <Navigate to="/reseller" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-6">
      <Link to="/reseller" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to POS
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Operators</h1>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-orange-600 to-amber-600 text-white hover:opacity-90">
              Add Operator
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Operator</DialogTitle></DialogHeader>
            <form
              onSubmit={(e) => { e.preventDefault(); if (form.fullName.trim()) createOperator.mutate(); }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="op-name">Full Name *</Label>
                <Input id="op-name" value={form.fullName} required
                  onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />
              </div>
              {operator?.role === 'reseller_admin' && (
                <div className="space-y-2">
                  <Label htmlFor="op-role">Role</Label>
                  <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
                    <SelectTrigger id="op-role"><SelectValue /></SelectTrigger>
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

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <p className="text-slate-500 text-sm py-4">Loading…</p>
          ) : operators.length === 0 ? (
            <p className="text-slate-500 text-sm py-4">No operators yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>User ID</TableHead>
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
        </CardContent>
      </Card>
    </div>
  );
}
