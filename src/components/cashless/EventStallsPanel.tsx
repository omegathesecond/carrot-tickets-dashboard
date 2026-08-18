import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { KeyRound, Plus, Power, Store, ChevronRight } from 'lucide-react';
import { apiClient, type MerchantRow } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { OperatorCredentialsDialog } from '@/components/OperatorCredentialsDialog';

const initialsOf = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';

type AddForm = { name: string; commissionPercent: string };
const DEFAULT_FORM: AddForm = { name: '', commissionPercent: '0' };

/**
 * Stall (in-event merchant) management for ONE event — a bar, a food stall, a
 * merch table: anything that taps bands. A merchant is bound to a single
 * eventId, so this panel takes the event it lives under rather than asking the
 * organizer to pick one. The API enforces ownership of that event on every call.
 */
export function EventStallsPanel({ eventId }: { eventId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState<AddForm>(DEFAULT_FORM);
  const [issued, setIssued] = useState<{ title: string; loginCode?: string; pin: string } | null>(null);

  const { data: stalls = [], isLoading } = useQuery({
    queryKey: ['merchants', eventId],
    queryFn: () => apiClient.merchants.list(eventId),
    enabled: !!eventId,
  });

  const createStall = useMutation({
    mutationFn: () =>
      apiClient.merchants.create({
        eventId,
        name: form.name.trim(),
        commissionPercent: Number(form.commissionPercent) || 0,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['merchants', eventId] });
      toast.success('Stall created');
      setIssued({ title: 'Stall created', loginCode: res.loginCode, pin: res.pin });
      setIsAddOpen(false);
      setForm(DEFAULT_FORM);
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to create stall'),
  });

  const resetPin = useMutation({
    mutationFn: (id: string) => apiClient.merchants.resetPin(id),
    onSuccess: (res) => setIssued({ title: 'PIN reset', pin: res.pin }),
    onError: (e: Error) => toast.error(e.message || 'Failed to reset PIN'),
  });

  const setActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiClient.merchants.update(id, { isActive }),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ['merchants', eventId] });
      toast.success(vars.isActive ? 'Stall activated' : 'Stall disabled');
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to update stall'),
  });

  const pendingActiveId = setActive.isPending ? setActive.variables?.id : undefined;
  const isFormValid = form.name.trim().length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Bars, food stalls and merch tables that charge bands at this event, each with a commission cut
        </p>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-orange-600 to-amber-600 text-white hover:opacity-90">
              <Plus className="h-4 w-4 mr-1.5" />
              Add stall
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add stall</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); if (isFormValid) createStall.mutate(); }} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="v-name">Stall name</Label>
                <Input id="v-name" value={form.name} required className="h-12" placeholder="e.g. Main Bar or Food Court"
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="v-commission">Commission %</Label>
                <Input id="v-commission" type="number" min={0} max={100} step="0.5" value={form.commissionPercent}
                  className="h-12"
                  onChange={(e) => setForm((f) => ({ ...f, commissionPercent: e.target.value }))} />
                <p className="text-xs text-slate-500">Carrot's cut of every charge this stall collects (0–100).</p>
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createStall.isPending || !isFormValid}
                  className="bg-gradient-to-r from-orange-600 to-amber-600 text-white hover:opacity-90">
                  {createStall.isPending ? 'Creating…' : 'Create'}
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
      ) : stalls.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center text-center py-14 gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-orange-500">
              <Store className="h-6 w-6" />
            </span>
            <p className="font-medium text-slate-700">No stalls yet</p>
            <p className="text-sm text-slate-500 max-w-xs">
              Add a stall to give it its own login code + PIN for charging bands at this event.
            </p>
            <Button onClick={() => setIsAddOpen(true)}
              className="mt-1 bg-gradient-to-r from-orange-600 to-amber-600 text-white hover:opacity-90">
              <Plus className="h-4 w-4 mr-1.5" /> Add stall
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {stalls.map((v: MerchantRow) => {
            const active = v.status === 'active';
            return (
              <Card key={v._id} onClick={() => navigate(`/events/${eventId}/stalls/${v._id}`)}
                className={`group transition hover:shadow-md cursor-pointer ${active ? '' : 'opacity-75'}`}>
                <CardContent className="pt-5 flex flex-col gap-4 h-full">
                  <div className="flex items-start gap-3 text-left">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-white font-bold">
                      {initialsOf(v.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900 leading-tight truncate group-hover:text-orange-600">{v.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{v.commissionPercent}% commission</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant={active ? 'default' : 'secondary'}>{active ? 'Active' : 'Disabled'}</Badge>
                      <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-orange-400" />
                    </div>
                  </div>

                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">Login code</p>
                    <p className="font-mono text-sm text-slate-800">{v.loginCode}</p>
                  </div>

                  <div className="mt-auto grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" disabled={resetPin.isPending}
                      onClick={(e) => { e.stopPropagation(); resetPin.mutate(v._id); }}>
                      <KeyRound className="h-4 w-4 mr-1.5" /> Reset PIN
                    </Button>
                    <Button variant="outline" size="sm" disabled={pendingActiveId === v._id}
                      onClick={(e) => { e.stopPropagation(); setActive.mutate({ id: v._id, isActive: !active }); }}
                      className={active
                        ? 'text-red-600 hover:text-red-700 hover:border-red-300'
                        : 'text-emerald-600 hover:text-emerald-700 hover:border-emerald-300'}>
                      <Power className="h-4 w-4 mr-1.5" />{active ? 'Disable' : 'Enable'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {issued && (
        <OperatorCredentialsDialog open={!!issued} onClose={() => setIssued(null)}
          title={issued.title} loginCode={issued.loginCode} pin={issued.pin} />
      )}
    </div>
  );
}
