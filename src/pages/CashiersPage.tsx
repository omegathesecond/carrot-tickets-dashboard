import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { KeyRound, Plus, Power, UserPlus, ChevronRight } from 'lucide-react';
import { apiClient, type CashierRow } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { OperatorCredentialsDialog } from '@/components/OperatorCredentialsDialog';

const initialsOf = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';

type AddForm = { fullName: string; phoneNumber: string };
const DEFAULT_FORM: AddForm = { fullName: '', phoneNumber: '' };

/**
 * Carrot's own platform-scoped staff — cashiers with no owning organizer or
 * event, hired directly by the platform. Organizer cashiers are hired for
 * ONE event now (immutable) and are managed from inside that event's
 * Cashless > Cashiers sub-tab instead (CashiersPanel); this page only ever
 * creates `scope: 'platform'` cashiers. It renders at /cashiers, which the
 * sidebar now only shows to super-admins — see Sidebar.tsx.
 */
export function CashiersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState<AddForm>(DEFAULT_FORM);
  const [issued, setIssued] = useState<{ title: string; loginCode?: string; pin: string } | null>(null);

  // Deliberately unscoped (no eventId filter) — a super-admin here sees every
  // cashier in the system, platform and organizer alike, for oversight.
  const { data: cashiers = [], isLoading, isError, error } = useQuery({
    queryKey: ['cashiers'],
    queryFn: () => apiClient.cashiers.list(),
  });

  const createCashier = useMutation({
    mutationFn: () => apiClient.cashiers.create({
      fullName: form.fullName,
      ...(form.phoneNumber.trim() ? { phoneNumber: form.phoneNumber.trim() } : {}),
      scope: 'platform',
    }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['cashiers'] });
      toast.success('Cashier created');
      setIssued({ title: 'Cashier created', loginCode: res.loginCode, pin: res.pin });
      setIsAddOpen(false);
      setForm(DEFAULT_FORM);
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to create cashier'),
  });

  const resetPin = useMutation({
    mutationFn: (id: string) => apiClient.cashiers.resetPin(id),
    onSuccess: (res) => setIssued({ title: 'PIN reset', pin: res.pin }),
    onError: (e: Error) => toast.error(e.message || 'Failed to reset PIN'),
  });

  const setActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => apiClient.cashiers.setActive(id, isActive),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ['cashiers'] });
      toast.success(vars.isActive ? 'Cashier activated' : 'Cashier deactivated');
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to update cashier'),
  });

  // Per-row pending ids — a mutation in flight for one cashier must not
  // disable the same action on every other row.
  const pendingResetId = resetPin.isPending ? resetPin.variables : undefined;
  const pendingActiveId = setActive.isPending ? setActive.variables?.id : undefined;
  const isFormValid = form.fullName.trim().length > 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Cashiers</h1>
            <p className="text-sm text-slate-500">
              Carrot's own platform-wide money desk staff
            </p>
          </div>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-orange-600 to-amber-600 text-white hover:opacity-90">
                <Plus className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Add cashier</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add cashier</DialogTitle></DialogHeader>
              <form
                onSubmit={(e) => { e.preventDefault(); if (isFormValid) createCashier.mutate(); }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="c-name">Full name</Label>
                  <Input id="c-name" value={form.fullName} required className="h-12"
                    onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="c-phone">Phone number (optional)</Label>
                  <Input id="c-phone" value={form.phoneNumber} className="h-12" placeholder="+268..."
                    onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))} />
                </div>
                <div className="flex justify-end space-x-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={createCashier.isPending || !isFormValid}
                    className="bg-gradient-to-r from-orange-600 to-amber-600 text-white hover:opacity-90">
                    {createCashier.isPending ? 'Creating…' : 'Create'}
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
        ) : isError ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-red-600">
              Could not load cashiers{error instanceof Error && error.message ? ` — ${error.message}` : ''}.
            </CardContent>
          </Card>
        ) : cashiers.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center text-center py-14 gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-orange-500">
                <UserPlus className="h-6 w-6" />
              </span>
              <p className="font-medium text-slate-700">No cashiers yet</p>
              <p className="text-sm text-slate-500 max-w-xs">
                Add a cashier to give someone their own User ID and PIN for topping up and cashing out bands.
              </p>
              <Button onClick={() => setIsAddOpen(true)}
                className="mt-1 bg-gradient-to-r from-orange-600 to-amber-600 text-white hover:opacity-90">
                <Plus className="h-4 w-4 mr-1.5" /> Add cashier
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cashiers.map((c: CashierRow) => (
              <Card
                key={c._id}
                onClick={() => navigate(`/cashiers/${c._id}`)}
                className={`group transition hover:shadow-md cursor-pointer ${c.isActive ? '' : 'opacity-75'}`}
              >
                <CardContent className="pt-5 flex flex-col gap-4 h-full">
                  <div className="flex items-start gap-3 text-left">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-white font-bold">
                      {initialsOf(c.fullName)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900 leading-tight truncate group-hover:text-orange-600">{c.fullName}</p>
                      {c.phoneNumber && <p className="text-xs text-slate-500 mt-0.5">{c.phoneNumber}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant={c.isActive ? 'default' : 'secondary'}>{c.isActive ? 'Active' : 'Inactive'}</Badge>
                      <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-orange-400" />
                    </div>
                  </div>

                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">User ID</p>
                    <p className="font-mono text-sm text-slate-800">{c.loginCode}</p>
                  </div>

                  <div className="mt-auto grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" disabled={pendingResetId === c._id}
                      onClick={(e) => { e.stopPropagation(); resetPin.mutate(c._id); }}>
                      <KeyRound className="h-4 w-4 mr-1.5" /> Reset PIN
                    </Button>
                    <Button variant="outline" size="sm" disabled={pendingActiveId === c._id}
                      onClick={(e) => { e.stopPropagation(); setActive.mutate({ id: c._id, isActive: !c.isActive }); }}
                      className={c.isActive
                        ? 'text-red-600 hover:text-red-700 hover:border-red-300'
                        : 'text-emerald-600 hover:text-emerald-700 hover:border-emerald-300'}>
                      <Power className="h-4 w-4 mr-1.5" />{c.isActive ? 'Disable' : 'Enable'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {issued && (
        <OperatorCredentialsDialog open={!!issued} onClose={() => setIssued(null)}
          title={issued.title} loginCode={issued.loginCode} pin={issued.pin} />
      )}
    </div>
  );
}
