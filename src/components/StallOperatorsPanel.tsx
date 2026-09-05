import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient, type OperatorGrant } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { OperatorCredentialsDialog } from '@/components/OperatorCredentialsDialog';
import { OperatorGrantsField } from '@/components/OperatorGrantsField';

type Credentials = { title: string; loginCode?: string; pin: string };

/**
 * The people who work ONE stall's till — each with their own login code +
 * PIN, so a charge names a human instead of the stall. The stall itself
 * (Merchant) holds no credentials any more; this panel is where they live.
 * Mounted on the stall detail page (/events/:id/stalls/:merchantId), which
 * already loads under MANAGE_ACCESS, so no separate permission gate is
 * needed here.
 */
export function StallOperatorsPanel({ merchantId, stallName }: { merchantId: string; stallName: string }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<{ fullName: string; phoneNumber: string; grants: OperatorGrant[] }>(
    { fullName: '', phoneNumber: '', grants: [] },
  );
  const [credentials, setCredentials] = useState<Credentials | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['merchantOperators', merchantId],
    queryFn: () => apiClient.merchantOperators.list(merchantId),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['merchantOperators', merchantId] });

  const create = useMutation({
    mutationFn: () => apiClient.merchantOperators.create(merchantId, {
      fullName: form.fullName.trim(),
      ...(form.phoneNumber.trim() ? { phoneNumber: form.phoneNumber.trim() } : {}),
      grants: form.grants,
    }),
    onSuccess: (res) => {
      setAdding(false);
      setForm({ fullName: '', phoneNumber: '', grants: [] });
      setCredentials({ title: `${res.operator.fullName} — till login`, loginCode: res.loginCode, pin: res.pin });
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to add person'),
  });

  const resetPin = useMutation({
    mutationFn: (id: string) => apiClient.merchantOperators.resetPin(id),
    onSuccess: (res) => setCredentials({ title: 'New PIN', pin: res.pin }),
    onError: (e: Error) => toast.error(e.message || 'Failed to reset PIN'),
  });

  const setActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiClient.merchantOperators.update(id, { isActive }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message || 'Failed to update person'),
  });

  const setGrants = useMutation({
    mutationFn: ({ id, grants }: { id: string; grants: OperatorGrant[] }) =>
      apiClient.merchantOperators.update(id, { grants }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message || 'Failed to update person'),
  });

  const operators = data?.operators ?? [];
  // Per-row pending ids — a mutation in flight for one operator must not
  // disable the same action on every other row (mirrors EventStallsPanel's
  // pendingActiveId in this same commit).
  const pendingResetId = resetPin.isPending ? resetPin.variables : undefined;
  const pendingActiveId = setActive.isPending ? setActive.variables?.id : undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">People on this till</h3>
          <p className="text-sm text-muted-foreground">
            Everyone gets their own code, so each sale names who rang it up.
          </p>
        </div>
        <Button size="sm" onClick={() => setAdding(true)}>Add person</Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {isError && (
        <p className="text-sm text-red-600 py-4">
          Could not load the people on this till{error instanceof Error && error.message ? ` — ${error.message}` : ''}.
        </p>
      )}
      {!isLoading && !isError && operators.length === 0 && (
        <p className="text-sm text-muted-foreground py-4">
          Nobody can sell at this stall yet — add the first person.
        </p>
      )}

      {!isError && operators.length > 0 && (
        <ul className="divide-y rounded-md border">
          {operators.map((op) => (
            <li key={op._id} className="flex flex-col gap-3 p-3">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">{op.fullName}</p>
                  <p className="text-sm text-muted-foreground">
                    {op.loginCode}
                    {!op.isActive && ' · deactivated'}
                    {op.lastLoginAt && ` · last in ${new Date(op.lastLoginAt).toLocaleString()}`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="outline" disabled={pendingResetId === op._id}
                    onClick={() => resetPin.mutate(op._id)}>
                    Reset PIN
                  </Button>
                  <Button
                    size="sm"
                    variant={op.isActive ? 'outline' : 'default'}
                    disabled={pendingActiveId === op._id}
                    onClick={() => setActive.mutate({ id: op._id, isActive: !op.isActive })}
                  >
                    {op.isActive ? 'Deactivate' : 'Reactivate'}
                  </Button>
                </div>
              </div>
              <OperatorGrantsField
                population="merchant"
                idPrefix={`stall-op-${op._id}`}
                value={op.grants ?? []}
                disabled={setGrants.isPending}
                onChange={(grants) => setGrants.mutate({ id: op._id, grants })}
              />
            </li>
          ))}
        </ul>
      )}

      <Dialog open={adding} onOpenChange={(v) => !v && setAdding(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add someone to {stallName}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); if (form.fullName.trim()) create.mutate(); }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="op-name">Full name</Label>
              <Input
                id="op-name" className="h-12" value={form.fullName} required
                onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="op-phone">Phone (optional)</Label>
              <Input
                id="op-phone" className="h-12" value={form.phoneNumber}
                onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Extra permissions</Label>
              <OperatorGrantsField
                population="merchant"
                idPrefix="stall-op"
                value={form.grants}
                onChange={(grants) => setForm((f) => ({ ...f, grants }))}
              />
            </div>
            <Button
              type="submit" className="w-full" disabled={!form.fullName.trim() || create.isPending}
            >
              {create.isPending ? 'Adding…' : 'Add person'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <OperatorCredentialsDialog
        open={!!credentials}
        onClose={() => setCredentials(null)}
        title={credentials?.title ?? ''}
        loginCode={credentials?.loginCode}
        pin={credentials?.pin ?? ''}
        businessName={stallName}
      />
    </div>
  );
}
