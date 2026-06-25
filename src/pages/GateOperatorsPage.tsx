import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { KeyRound, Plus, Power, UserPlus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient, type GateOperatorRow } from '@/lib/api';
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
import { OperatorCredentialsDialog } from '@/components/OperatorCredentialsDialog';

const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?';

type AddForm = {
  fullName: string;
  phoneNumber: string;
  scope: 'platform' | 'organizer';
  vendorId: string;
};

const DEFAULT_FORM: AddForm = {
  fullName: '',
  phoneNumber: '',
  scope: 'organizer',
  vendorId: '',
};

export function GateOperatorsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState<AddForm>(DEFAULT_FORM);
  const [issued, setIssued] = useState<{ title: string; loginCode?: string; pin: string } | null>(null);

  const { data: operators = [], isLoading } = useQuery({
    queryKey: ['gate-operators'],
    queryFn: () => apiClient.gateOperators.list(),
  });

  const createOperator = useMutation({
    mutationFn: () => {
      const data: Parameters<typeof apiClient.gateOperators.create>[0] = {
        fullName: form.fullName,
        ...(form.phoneNumber.trim() ? { phoneNumber: form.phoneNumber.trim() } : {}),
        ...(user?.isSuperAdmin
          ? {
              scope: form.scope,
              ...(form.scope === 'organizer' && form.vendorId.trim()
                ? { vendorId: form.vendorId.trim() }
                : {}),
            }
          : {}),
      };
      return apiClient.gateOperators.create(data);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['gate-operators'] });
      toast.success('Gate operator created');
      setIssued({ title: 'Gate operator created', loginCode: res.loginCode, pin: res.pin });
      setIsAddOpen(false);
      setForm(DEFAULT_FORM);
    },
    onError: (e: any) => toast.error(e.message || 'Failed to create operator'),
  });

  const resetPin = useMutation({
    mutationFn: (id: string) => apiClient.gateOperators.resetPin(id),
    onSuccess: (res) => setIssued({ title: 'PIN reset', pin: res.pin }),
    onError: (e: any) => toast.error(e.message || 'Failed to reset PIN'),
  });

  const setActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiClient.gateOperators.setActive(id, isActive),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ['gate-operators'] });
      toast.success(vars.isActive ? 'Operator activated' : 'Operator deactivated');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to update operator'),
  });

  const pendingActiveId = setActive.isPending ? setActive.variables?.id : undefined;

  const isFormValid =
    form.fullName.trim().length > 0 &&
    (!user?.isSuperAdmin || form.scope !== 'organizer' || form.vendorId.trim().length > 0);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Gate Operators</h1>
            <p className="text-sm text-slate-500">
              {operators.length} {operators.length === 1 ? 'person' : 'people'} with gate access
            </p>
          </div>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-orange-600 to-amber-600 text-white hover:opacity-90">
                <Plus className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Add gate operator</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add gate operator</DialogTitle></DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (isFormValid) createOperator.mutate();
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="go-name">Full name</Label>
                  <Input
                    id="go-name"
                    value={form.fullName}
                    required
                    className="h-12"
                    onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="go-phone">Phone number (optional)</Label>
                  <Input
                    id="go-phone"
                    value={form.phoneNumber}
                    className="h-12"
                    placeholder="+268..."
                    onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))}
                  />
                </div>
                {user?.isSuperAdmin && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="go-scope">Scope</Label>
                      <Select
                        value={form.scope}
                        onValueChange={(v) =>
                          setForm((f) => ({ ...f, scope: v as 'platform' | 'organizer', vendorId: '' }))
                        }
                      >
                        <SelectTrigger id="go-scope" className="h-12"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="platform">Platform-wide (all events)</SelectItem>
                          <SelectItem value="organizer">Specific organizer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {form.scope === 'organizer' && (
                      <div className="space-y-2">
                        <Label htmlFor="go-vendor">Organizer vendor ID</Label>
                        <Input
                          id="go-vendor"
                          value={form.vendorId}
                          required
                          className="h-12"
                          placeholder="e.g. 6642abc..."
                          onChange={(e) => setForm((f) => ({ ...f, vendorId: e.target.value }))}
                        />
                      </div>
                    )}
                  </>
                )}
                <div className="flex justify-end space-x-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createOperator.isPending || !isFormValid}
                    className="bg-gradient-to-r from-orange-600 to-amber-600 text-white hover:opacity-90"
                  >
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
              <p className="font-medium text-slate-700">No gate operators yet</p>
              <p className="text-sm text-slate-500 max-w-xs">
                Add a gate operator to give someone their own User ID and PIN for scanning tickets at events.
              </p>
              <Button
                onClick={() => setIsAddOpen(true)}
                className="mt-1 bg-gradient-to-r from-orange-600 to-amber-600 text-white hover:opacity-90"
              >
                <Plus className="h-4 w-4 mr-1.5" /> Add gate operator
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {operators.map((op: GateOperatorRow) => (
              <Card key={op._id} className={op.isActive ? '' : 'opacity-75'}>
                <CardContent className="pt-5 flex flex-col gap-4 h-full">
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-white font-bold">
                      {initialsOf(op.fullName)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900 leading-tight truncate">{op.fullName}</p>
                      {op.phoneNumber && (
                        <p className="text-xs text-slate-500 mt-0.5">{op.phoneNumber}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant={op.isActive ? 'default' : 'secondary'}>
                        {op.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {op.scope === 'platform' ? 'Platform' : 'Organizer'}
                      </Badge>
                    </div>
                  </div>

                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">User ID</p>
                    <p className="font-mono text-sm text-slate-800">{op.loginCode}</p>
                  </div>

                  <div className="mt-auto grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={resetPin.isPending}
                      onClick={() => resetPin.mutate(op._id)}
                    >
                      <KeyRound className="h-4 w-4 mr-1.5" /> Reset PIN
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pendingActiveId === op._id}
                      onClick={() => setActive.mutate({ id: op._id, isActive: !op.isActive })}
                      className={
                        op.isActive
                          ? 'text-red-600 hover:text-red-700 hover:border-red-300'
                          : 'text-emerald-600 hover:text-emerald-700 hover:border-emerald-300'
                      }
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
