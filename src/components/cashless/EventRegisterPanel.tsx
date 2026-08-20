import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { KeyRound, Nfc, Plus, Power, ScanLine, Search, UserPlus } from 'lucide-react';
import { apiClient, type GateOperatorRow, type TagRegistrationRow } from '@/lib/api';
import { fmtR } from '@/lib/money';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { OperatorCredentialsDialog } from '@/components/OperatorCredentialsDialog';
import { ViewAffordance } from '@/components/ViewAffordance';

const initialsOf = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';

const fmtWhen = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('en-ZA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

type AddForm = { fullName: string; phoneNumber: string };
const DEFAULT_FORM: AddForm = { fullName: '', phoneNumber: '' };

/**
 * The register desk for ONE event: the people who bind blank tags to tickets,
 * and the log of every tag they have handed out.
 *
 * A register account is NOT a fourth kind of operator — it is a gate operator
 * assigned to this event carrying the `issue_tags` grant. Roles are the floor
 * and grants are the per-person extras (see OperatorGrant on the API), so the
 * desk gets its own screen without a second credential/lockout/auth stack to
 * keep in step. Creating one here just picks the event and the grant for you.
 */
export function EventRegisterPanel({ eventId }: { eventId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState<AddForm>(DEFAULT_FORM);
  const [issued, setIssued] = useState<{ title: string; loginCode?: string; pin: string } | null>(null);
  const [q, setQ] = useState('');

  const { data: operators = [], isLoading: loadingOperators, isError: operatorsFailed, error: operatorsError } = useQuery({
    queryKey: ['gate-operators'],
    queryFn: () => apiClient.gateOperators.list(),
  });

  const { data: log, isLoading: loadingLog, isError: logFailed, error: logError } = useQuery({
    queryKey: ['tag-registrations', eventId, q],
    queryFn: () => apiClient.tags.registrations(eventId, { ...(q.trim() ? { q: q.trim() } : {}) }),
  });

  // An empty eventIds means "every event of this organizer" (see GateOperatorRow),
  // so those people work this desk too — they are just not pinned to it.
  const registrars = operators.filter(
    (o: GateOperatorRow) =>
      (o.grants ?? []).includes('issue_tags')
      && (o.eventIds?.length ? o.eventIds.includes(eventId) : true),
  );

  const invalidateOperators = () => queryClient.invalidateQueries({ queryKey: ['gate-operators'] });

  const createRegistrar = useMutation({
    mutationFn: () => apiClient.gateOperators.create({
      fullName: form.fullName.trim(),
      ...(form.phoneNumber.trim() ? { phoneNumber: form.phoneNumber.trim() } : {}),
      eventIds: [eventId],
      grants: ['issue_tags'],
    }),
    onSuccess: (res) => {
      invalidateOperators();
      toast.success('Register account created');
      setIssued({ title: 'Register account created', loginCode: res.loginCode, pin: res.pin });
      setIsAddOpen(false);
      setForm(DEFAULT_FORM);
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to create the register account'),
  });

  const resetPin = useMutation({
    mutationFn: (id: string) => apiClient.gateOperators.resetPin(id),
    onSuccess: (res) => setIssued({ title: 'PIN reset', pin: res.pin }),
    onError: (e: Error) => toast.error(e.message || 'Failed to reset PIN'),
  });

  const setActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiClient.gateOperators.setActive(id, isActive),
    onSuccess: (_res, vars) => {
      invalidateOperators();
      toast.success(vars.isActive ? 'Register account activated' : 'Register account disabled');
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to update the register account'),
  });

  const pendingResetId = resetPin.isPending ? resetPin.variables : undefined;
  const pendingActiveId = setActive.isPending ? setActive.variables?.id : undefined;
  const isFormValid = form.fullName.trim().length > 0;
  const registrations = log?.registrations ?? [];

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-slate-900">Register accounts</h3>
            <p className="text-sm text-muted-foreground">
              Each person gets their own User ID and PIN for the POS app, and can bind blank tags to tickets at this event.
            </p>
          </div>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-orange-600 to-amber-600 text-white hover:opacity-90 shrink-0">
                <Plus className="h-4 w-4 mr-1.5" /> Add register account
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add register account</DialogTitle></DialogHeader>
              <form
                onSubmit={(e) => { e.preventDefault(); if (isFormValid) createRegistrar.mutate(); }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="reg-name">Full name</Label>
                  <Input id="reg-name" value={form.fullName} required className="h-12"
                    onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-phone">Phone number (optional)</Label>
                  <Input id="reg-phone" value={form.phoneNumber} className="h-12" placeholder="+268..."
                    onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))} />
                </div>
                <p className="text-xs text-muted-foreground">
                  They will be assigned to this event and given permission to register tags.
                </p>
                <div className="flex justify-end space-x-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={createRegistrar.isPending || !isFormValid}
                    className="bg-gradient-to-r from-orange-600 to-amber-600 text-white hover:opacity-90">
                    {createRegistrar.isPending ? 'Creating…' : 'Create'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {loadingOperators ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <Card key={i}><CardContent className="h-40 animate-pulse bg-slate-100/60 rounded-xl" /></Card>
            ))}
          </div>
        ) : operatorsFailed ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-red-600">
              Could not load the register accounts
              {operatorsError instanceof Error && operatorsError.message ? ` — ${operatorsError.message}` : ''}.
            </CardContent>
          </Card>
        ) : registrars.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center text-center py-14 gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-orange-500">
                <UserPlus className="h-6 w-6" />
              </span>
              <p className="font-medium text-slate-700">No register accounts yet</p>
              <p className="text-sm text-slate-500 max-w-xs">
                Add one to let someone register tags to this event from the POS app.
              </p>
              <Button onClick={() => setIsAddOpen(true)}
                className="mt-1 bg-gradient-to-r from-orange-600 to-amber-600 text-white hover:opacity-90">
                <Plus className="h-4 w-4 mr-1.5" /> Add register account
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {registrars.map((op: GateOperatorRow) => (
              <Card
                key={op._id}
                onClick={() => navigate(`/gate-operators/${op._id}`)}
                className={`group transition hover:shadow-md cursor-pointer ${op.isActive ? '' : 'opacity-75'}`}
              >
                <CardContent className="pt-5 flex flex-col gap-4 h-full">
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-white font-bold">
                      {initialsOf(op.fullName)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900 leading-tight truncate group-hover:text-orange-600">{op.fullName}</p>
                      {op.phoneNumber && <p className="text-xs text-slate-500 mt-0.5">{op.phoneNumber}</p>}
                    </div>
                    <Badge variant={op.isActive ? 'default' : 'secondary'}>{op.isActive ? 'Active' : 'Inactive'}</Badge>
                  </div>

                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">User ID</p>
                    <p className="font-mono text-sm text-slate-800">{op.loginCode}</p>
                  </div>

                  {!op.eventIds?.length && (
                    <p className="text-xs text-slate-500">Works every event of yours, not just this one.</p>
                  )}

                  <ViewAffordance label="View activity" />

                  <div className="mt-auto grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" disabled={pendingResetId === op._id}
                      onClick={(e) => { e.stopPropagation(); resetPin.mutate(op._id); }}>
                      <KeyRound className="h-4 w-4 mr-1.5" /> Reset PIN
                    </Button>
                    <Button variant="outline" size="sm" disabled={pendingActiveId === op._id}
                      onClick={(e) => { e.stopPropagation(); setActive.mutate({ id: op._id, isActive: !op.isActive }); }}
                      className={op.isActive
                        ? 'text-red-600 hover:text-red-700 hover:border-red-300'
                        : 'text-emerald-600 hover:text-emerald-700 hover:border-emerald-300'}>
                      <Power className="h-4 w-4 mr-1.5" />{op.isActive ? 'Disable' : 'Enable'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-slate-900">Registered tags</h3>
            <p className="text-sm text-muted-foreground">
              Every tag handed out at this event, newest first — including ones since reported lost or reissued.
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Search tag ID" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            {loadingLog ? (
              <p className="text-sm text-muted-foreground py-4">Loading registrations…</p>
            ) : logFailed ? (
              <p className="text-sm text-red-600 py-4">
                Could not load the registrations
                {logError instanceof Error && logError.message ? ` — ${logError.message}` : ''}.
              </p>
            ) : registrations.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                {q.trim() ? `No tag matching “${q.trim()}” has been registered.` : 'No tags registered yet.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tag ID</TableHead>
                      <TableHead>Holder</TableHead>
                      <TableHead>Registered by</TableHead>
                      <TableHead>When</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {registrations.map((r: TagRegistrationRow) => (
                      <TableRow key={`${r.walletId}-${r.at}`}>
                        <TableCell className="font-mono text-xs">
                          <span className="inline-flex items-center gap-1.5">
                            <Nfc className="h-3.5 w-3.5 text-orange-600" />
                            {r.bandUid}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{r.holder.name ?? 'Unknown'}</div>
                          <div className="text-xs text-muted-foreground">{r.holder.phone ?? r.holder.ticketCode ?? ''}</div>
                        </TableCell>
                        <TableCell>{r.registeredBy}</TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">{fmtWhen(r.at)}</TableCell>
                        <TableCell className="text-right font-semibold">{fmtR(r.balance)}</TableCell>
                        <TableCell>
                          {r.releasedAt ? (
                            <Badge variant="secondary" className="bg-slate-100 text-slate-700">Released</Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-green-100 text-green-800">On the wrist</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {log?.hasMore && (
                  <p className="text-xs text-muted-foreground mt-3 inline-flex items-center gap-1.5">
                    <ScanLine className="h-3.5 w-3.5" /> Showing the most recent 50 registrations.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {issued && (
        <OperatorCredentialsDialog open={!!issued} onClose={() => setIssued(null)}
          title={issued.title} loginCode={issued.loginCode} pin={issued.pin} />
      )}
    </div>
  );
}
