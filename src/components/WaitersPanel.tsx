import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { HandCoins, KeyRound, Plus, Power, UtensilsCrossed } from 'lucide-react';
import { apiClient, type WaiterRow } from '@/lib/api';
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
 * The organizer's floor staff for ONE event — waiters open a table and add
 * items, each with their own login code + PIN. Settling a table (taking the
 * final payment and closing it out) is a separate, per-person grant that is
 * OFF by default — the API refuses a settle attempt without it — so it is
 * offered here as its own on/off control on the card rather than folded into
 * an edit form, mirroring CashiersPanel's "Tag desk" toggle. A waiter is
 * hired for exactly one event and the event is immutable at the API, so this
 * panel takes the event it lives under rather than asking which one.
 */
export function WaitersPanel({ eventId }: { eventId: string }) {
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState<AddForm>(DEFAULT_FORM);
  const [issued, setIssued] = useState<{ title: string; loginCode?: string; pin: string } | null>(null);

  const { data: waiters = [], isLoading, isError, error } = useQuery({
    queryKey: ['waiters', eventId],
    queryFn: () => apiClient.waiters.list(eventId),
    enabled: !!eventId,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['waiters', eventId] });

  const createWaiter = useMutation({
    mutationFn: () => apiClient.waiters.create({
      fullName: form.fullName,
      ...(form.phoneNumber.trim() ? { phoneNumber: form.phoneNumber.trim() } : {}),
      eventId,
    }),
    onSuccess: (res) => {
      invalidate();
      toast.success('Waiter created');
      setIssued({ title: 'Waiter created', loginCode: res.loginCode, pin: res.pin });
      setIsAddOpen(false);
      setForm(DEFAULT_FORM);
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to create waiter'),
  });

  const resetPin = useMutation({
    mutationFn: (id: string) => apiClient.waiters.resetPin(id),
    onSuccess: (res) => setIssued({ title: 'PIN reset', pin: res.pin }),
    onError: (e: Error) => toast.error(e.message || 'Failed to reset PIN'),
  });

  // The toast names what the setting actually buys — who may take money at
  // the end of the night — rather than a generic "saved", because that is
  // the real-world consequence of flipping this switch.
  const setSettling = useMutation({
    mutationFn: ({ id, on }: { id: string; on: boolean }) =>
      apiClient.waiters.setGrants(id, on ? ['settle_tables'] : []),
    onSuccess: (_res, vars) => {
      invalidate();
      toast.success(
        vars.on
          ? 'Settling on — they can settle tables and take payment at close-out'
          : 'Settling off — they can serve but not settle tables',
      );
    },
    onError: (e: Error) => toast.error(e.message || 'Could not change the settling permission'),
  });

  const setActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => apiClient.waiters.setActive(id, isActive),
    onSuccess: (_res, vars) => {
      invalidate();
      toast.success(vars.isActive ? 'Waiter activated' : 'Waiter deactivated');
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to update waiter'),
  });

  // Per-row pending ids — a mutation in flight for one waiter must not
  // disable the same action on every other row.
  const pendingResetId = resetPin.isPending ? resetPin.variables : undefined;
  const pendingSettleId = setSettling.isPending ? setSettling.variables?.id : undefined;
  const pendingActiveId = setActive.isPending ? setActive.variables?.id : undefined;
  const isFormValid = form.fullName.trim().length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Everyone gets their own login and PIN, so every table opened at this event is attributed to a person.
        </p>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-orange-600 to-amber-600 text-white hover:opacity-90">
              <Plus className="h-4 w-4 mr-1.5" />
              Add waiter
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add waiter</DialogTitle></DialogHeader>
            <form
              onSubmit={(e) => { e.preventDefault(); if (isFormValid) createWaiter.mutate(); }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="w-name">Full name</Label>
                <Input id="w-name" value={form.fullName} required className="h-12"
                  onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="w-phone">Phone number (optional)</Label>
                <Input id="w-phone" value={form.phoneNumber} className="h-12" placeholder="+268..."
                  onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))} />
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createWaiter.isPending || !isFormValid}
                  className="bg-gradient-to-r from-orange-600 to-amber-600 text-white hover:opacity-90">
                  {createWaiter.isPending ? 'Creating…' : 'Create'}
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
            Could not load waiters{error instanceof Error && error.message ? ` — ${error.message}` : ''}.
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && waiters.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center text-center py-14 gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-orange-500">
              <UtensilsCrossed className="h-6 w-6" />
            </span>
            <p className="font-medium text-slate-700">No waiters yet</p>
            <p className="text-sm text-slate-500 max-w-xs">
              Add a waiter to give someone their own User ID and PIN for opening tables and adding items at this event.
            </p>
            <Button onClick={() => setIsAddOpen(true)}
              className="mt-1 bg-gradient-to-r from-orange-600 to-amber-600 text-white hover:opacity-90">
              <Plus className="h-4 w-4 mr-1.5" /> Add waiter
            </Button>
          </CardContent>
        </Card>
      )}

      {!isError && waiters.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {waiters.map((w: WaiterRow) => (
            <Card key={w._id} className={w.isActive ? '' : 'opacity-75'}>
              <CardContent className="pt-5 flex flex-col gap-4 h-full">
                <div className="flex items-start gap-3 text-left">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-white font-bold">
                    {initialsOf(w.fullName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900 leading-tight truncate">{w.fullName}</p>
                    {w.phoneNumber && <p className="text-xs text-slate-500 mt-0.5">{w.phoneNumber}</p>}
                  </div>
                  <Badge variant={w.isActive ? 'default' : 'secondary'}>{w.isActive ? 'Active' : 'Inactive'}</Badge>
                </div>

                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">User ID</p>
                  <p className="font-mono text-sm text-slate-800">{w.loginCode}</p>
                </div>

                <div className="mt-auto grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm"
                    disabled={pendingSettleId === w._id}
                    onClick={() => setSettling.mutate({ id: w._id, on: !(w.grants ?? []).includes('settle_tables') })}
                    className={(w.grants ?? []).includes('settle_tables')
                      ? 'col-span-2 text-orange-600 hover:text-orange-700 hover:border-orange-300'
                      : 'col-span-2'}>
                    <HandCoins className="h-4 w-4 mr-1.5" />
                    {(w.grants ?? []).includes('settle_tables') ? 'Settling on' : 'Settling off'}
                  </Button>
                  <Button variant="outline" size="sm" disabled={pendingResetId === w._id}
                    onClick={() => resetPin.mutate(w._id)}>
                    <KeyRound className="h-4 w-4 mr-1.5" /> Reset PIN
                  </Button>
                  <Button variant="outline" size="sm" disabled={pendingActiveId === w._id}
                    onClick={() => setActive.mutate({ id: w._id, isActive: !w.isActive })}
                    className={w.isActive
                      ? 'text-red-600 hover:text-red-700 hover:border-red-300'
                      : 'text-emerald-600 hover:text-emerald-700 hover:border-emerald-300'}>
                    <Power className="h-4 w-4 mr-1.5" />{w.isActive ? 'Disable' : 'Enable'}
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
