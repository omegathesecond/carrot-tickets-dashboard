import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { KeyRound, Plus, Power, UserPlus } from 'lucide-react';
import { type OperatorGrant, apiClient, type CashierRow } from '@/lib/api';
import { OperatorGrantsField } from '@/components/OperatorGrantsField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { OperatorCredentialsDialog } from '@/components/OperatorCredentialsDialog';
import { ViewAffordance } from '@/components/ViewAffordance';

const initialsOf = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';

type AddForm = { fullName: string; phoneNumber: string; grants: OperatorGrant[] };
const DEFAULT_FORM: AddForm = { fullName: '', phoneNumber: '', grants: [] };

/**
 * The organizer's in-venue money desk staff for ONE event — top-up and
 * cash-out, each with their own login code + PIN. A cashier is hired for
 * exactly one event and the event is immutable at the API, so (unlike the
 * old cross-event picker) this panel takes the event it lives under rather
 * than asking which one. Mounted inside EventCashlessTab, which already
 * loads under canManageAccess, so no separate permission gate is needed
 * here — mirrors StallOperatorsPanel's shape.
 */
export function CashiersPanel({ eventId }: { eventId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState<AddForm>(DEFAULT_FORM);
  const [issued, setIssued] = useState<{ title: string; loginCode?: string; pin: string } | null>(null);

  const { data: cashiers = [], isLoading, isError, error } = useQuery({
    queryKey: ['cashiers', eventId],
    queryFn: () => apiClient.cashiers.list(eventId),
    enabled: !!eventId,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['cashiers', eventId] });

  const createCashier = useMutation({
    mutationFn: () => apiClient.cashiers.create({
      fullName: form.fullName,
      ...(form.phoneNumber.trim() ? { phoneNumber: form.phoneNumber.trim() } : {}),
      ...(form.grants.length ? { grants: form.grants } : {}),
      eventId,
    }),
    onSuccess: (res) => {
      invalidate();
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
      invalidate();
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
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Everyone gets their own login and PIN, so every top-up and cash-out at this event is attributed to a person.
        </p>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-orange-600 to-amber-600 text-white hover:opacity-90">
              <Plus className="h-4 w-4 mr-1.5" />
              Add cashier
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
              <div className="space-y-2">
                <Label>Extra permissions</Label>
                <OperatorGrantsField
                  population="cashier"
                  idPrefix="cashier"
                  value={form.grants}
                  onChange={(grants) => setForm((f) => ({ ...f, grants }))}
                />
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

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <Card key={i}><CardContent className="h-40 animate-pulse bg-slate-100/60 rounded-xl" /></Card>
          ))}
        </div>
      )}

      {isError && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-red-600">
            Could not load cashiers{error instanceof Error && error.message ? ` — ${error.message}` : ''}.
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && cashiers.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center text-center py-14 gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-orange-500">
              <UserPlus className="h-6 w-6" />
            </span>
            <p className="font-medium text-slate-700">No cashiers yet</p>
            <p className="text-sm text-slate-500 max-w-xs">
              Add a cashier to give someone their own User ID and PIN for topping up and cashing out bands at this event.
            </p>
            <Button onClick={() => setIsAddOpen(true)}
              className="mt-1 bg-gradient-to-r from-orange-600 to-amber-600 text-white hover:opacity-90">
              <Plus className="h-4 w-4 mr-1.5" /> Add cashier
            </Button>
          </CardContent>
        </Card>
      )}

      {!isError && cashiers.length > 0 && (
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
                  <Badge variant={c.isActive ? 'default' : 'secondary'}>{c.isActive ? 'Active' : 'Inactive'}</Badge>
                </div>

                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">User ID</p>
                  <p className="font-mono text-sm text-slate-800">{c.loginCode}</p>
                </div>

                <ViewAffordance label="View activity" />

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

      {issued && (
        <OperatorCredentialsDialog open={!!issued} onClose={() => setIssued(null)}
          title={issued.title} loginCode={issued.loginCode} pin={issued.pin} />
      )}
    </div>
  );
}
