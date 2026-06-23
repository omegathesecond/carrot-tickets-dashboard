import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { Plus, Users } from 'lucide-react';
import { type Reseller } from '@/types';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ConfirmDialog } from '@/components/ConfirmDialog';

export function ResellersPage() {
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState({
    businessName: '',
    email: '',
    phoneNumber: '',
    commissionPercent: '',
  });
  const [suspendTarget, setSuspendTarget] = useState<Reseller | null>(null);

  const { data: resellers = [], isLoading, isError: resellersError } = useQuery({
    queryKey: ['resellers'],
    queryFn: () => apiClient.resellerAdmin.listResellers(),
  });

  useEffect(() => {
    if (resellersError) toast.error('Failed to load resellers');
  }, [resellersError]);

  const createMutation = useMutation({
    mutationFn: () =>
      apiClient.resellerAdmin.createReseller({
        businessName: form.businessName,
        email: form.email || undefined,
        phoneNumber: form.phoneNumber || undefined,
        commissionPercent: form.commissionPercent !== '' ? parseFloat(form.commissionPercent) : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resellers'] });
      toast.success('Reseller created successfully');
      setIsAddOpen(false);
      setForm({ businessName: '', email: '', phoneNumber: '', commissionPercent: '' });
    },
    onError: (error: any) => toast.error(error.message || 'Failed to create reseller'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'active' | 'suspended' }) =>
      apiClient.resellerAdmin.updateReseller(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resellers'] });
      toast.success('Reseller status updated');
      setSuspendTarget(null);
    },
    onError: (error: any) => toast.error(error.message || 'Failed to update reseller status'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.businessName.trim()) return;
    createMutation.mutate();
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Users className="h-8 w-8 text-orange-600" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Resellers</h1>
            <p className="text-slate-500 text-sm">Manage reseller partners and their commission rates</p>
          </div>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-orange-600 to-amber-600 text-white hover:opacity-90">
              <Plus className="h-4 w-4 mr-2" />
              Add Reseller
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Reseller</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="businessName">Business Name *</Label>
                <Input
                  id="businessName"
                  value={form.businessName}
                  onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))}
                  placeholder="Business name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email (optional)</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="contact@business.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Phone Number (optional)</Label>
                <Input
                  id="phoneNumber"
                  value={form.phoneNumber}
                  onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))}
                  placeholder="+268 7800 0000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="commissionPercent">Commission % (optional — blank = platform default)</Label>
                <Input
                  id="commissionPercent"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.commissionPercent}
                  onChange={(e) => setForm((f) => ({ ...f, commissionPercent: e.target.value }))}
                  placeholder="e.g. 5"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || !form.businessName.trim()}
                  className="bg-gradient-to-r from-orange-600 to-amber-600 text-white hover:opacity-90"
                >
                  {createMutation.isPending ? 'Creating…' : 'Create Reseller'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Resellers ({resellers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-slate-500 text-sm py-4">Loading resellers…</p>
          ) : resellers.length === 0 ? (
            <p className="text-slate-500 text-sm py-4">No resellers yet. Add your first reseller above.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Commission</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resellers.map((r) => (
                  <TableRow key={r._id}>
                    <TableCell>
                      <Link
                        to={`/resellers/${r._id}`}
                        className="font-medium text-orange-600 hover:text-orange-800 hover:underline"
                      >
                        {r.businessName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {r.email || r.phoneNumber || '—'}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {r.commissionPercent === null ? 'Platform default' : `${r.commissionPercent}%`}
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.status === 'active' ? 'default' : 'destructive'}>
                        {r.status === 'active' ? 'Active' : 'Suspended'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSuspendTarget(r)}
                        className={r.status === 'active' ? 'text-red-600 border-red-200 hover:bg-red-50' : 'text-green-600 border-green-200 hover:bg-green-50'}
                      >
                        {r.status === 'active' ? 'Suspend' : 'Activate'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {suspendTarget && (
        <ConfirmDialog
          open={!!suspendTarget}
          onOpenChange={(open) => { if (!open) setSuspendTarget(null); }}
          title={suspendTarget.status === 'active' ? 'Suspend Reseller' : 'Activate Reseller'}
          description={
            suspendTarget.status === 'active'
              ? `Are you sure you want to suspend "${suspendTarget.businessName}"? They will lose access to the platform.`
              : `Are you sure you want to activate "${suspendTarget.businessName}"?`
          }
          confirmLabel={suspendTarget.status === 'active' ? 'Suspend' : 'Activate'}
          isLoading={statusMutation.isPending}
          onConfirm={() =>
            statusMutation.mutate({
              id: suspendTarget._id,
              status: suspendTarget.status === 'active' ? 'suspended' : 'active',
            })
          }
          destructive={suspendTarget.status === 'active'}
        />
      )}
    </div>
  );
}
