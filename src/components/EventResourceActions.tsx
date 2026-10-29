import { useState } from 'react';
import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { OperatorCredentialsDialog } from '@/components/OperatorCredentialsDialog';

type Values = { name: string; phoneNumber: string; commissionPercent: string };
type Props = {
  kind: string;
  initial: { name: string; phoneNumber?: string; commissionPercent?: string };
  canDelete: boolean;
  queryKey: QueryKey;
  onSave: (values: Values) => Promise<unknown>;
  onDelete: () => Promise<unknown>;
  onReveal?: () => Promise<{ loginCode: string; pin: string }>;
};

/** The same edit, delete and credential flow across event stalls and staff. */
export function EventResourceActions({ kind, initial, canDelete, queryKey, onSave, onDelete, onReveal }: Props) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<'edit' | 'delete' | null>(null);
  const [values, setValues] = useState<Values>({ name: '', phoneNumber: '', commissionPercent: '' });
  const [credentials, setCredentials] = useState<{ loginCode: string; pin: string } | null>(null);
  const refresh = () => {
    qc.invalidateQueries({ queryKey });
    for (const key of ['event-cashless-summary', 'stall-detail', 'cashier-detail', 'event-stock-allocations']) {
      qc.invalidateQueries({ queryKey: [key] });
    }
  };
  const save = useMutation({
    mutationFn: () => onSave({ ...values, name: values.name.trim(), phoneNumber: values.phoneNumber.trim() }),
    onSuccess: () => { refresh(); setMode(null); toast.success(`${kind} updated`); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: async () => {
      if (!canDelete) throw new Error('Super Admin access required');
      return onDelete();
    },
    onSuccess: () => { refresh(); setMode(null); toast.success(`${kind} deleted`); },
    onError: (e: Error) => toast.error(e.message),
  });
  const reveal = useMutation({
    gcTime: 0,
    mutationFn: async () => {
      if (!canDelete) throw new Error('Super Admin access required');
      if (!onReveal) throw new Error('PIN viewing is not available');
      return onReveal();
    },
    onSuccess: setCredentials,
    onError: (e: Error) => toast.error(e.message),
  });
  const stall = initial.commissionPercent !== undefined;
  const valid = !!values.name.trim() && (!stall || (
    values.commissionPercent.trim() !== '' && Number.isFinite(Number(values.commissionPercent))
    && Number(values.commissionPercent) >= 0 && Number(values.commissionPercent) <= 100
  ));
  const pending = save.isPending || remove.isPending;

  return (
    <div onClick={(e) => e.stopPropagation()} className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => {
          setValues({ name: initial.name, phoneNumber: initial.phoneNumber ?? '', commissionPercent: initial.commissionPercent ?? '' });
          setMode('edit');
        }}><Pencil className="h-4 w-4 mr-1.5" />Edit</Button>
        {canDelete && <Button size="sm" variant="outline" className="text-red-600" onClick={() => setMode('delete')}>
          <Trash2 className="h-4 w-4 mr-1.5" />Delete
        </Button>}
        {canDelete && onReveal && <Button size="sm" variant="outline" disabled={reveal.isPending} onClick={() => reveal.mutate()}>
          <Eye className="h-4 w-4 mr-1.5" />{reveal.isPending ? 'Loading PIN…' : 'Show PIN'}
        </Button>}
      </div>
      <Dialog open={mode !== null} onOpenChange={(open) => { if (!open && !pending) setMode(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{mode === 'delete' ? `Delete ${kind}` : `Edit ${kind}`}</DialogTitle></DialogHeader>
          {mode === 'delete' ? <div className="space-y-4">
            <p>Delete {initial.name}? {stall ? 'This stall and its till staff will lose access.' : 'This account will lose access.'} Sales and activity records will be kept for reporting.</p>
            {kind === 'register account' && <p className="text-sm text-muted-foreground">This deletes the account across every event it works.</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" disabled={pending} onClick={() => setMode(null)}>Cancel</Button>
              <Button variant="destructive" disabled={pending} onClick={() => remove.mutate()}>{remove.isPending ? 'Deleting…' : 'Delete'}</Button>
            </div>
          </div> : <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (valid && !pending) save.mutate(); }}>
            <div className="space-y-2"><Label htmlFor="resource-name">{stall ? 'Stall name' : 'Full name'}</Label>
              <Input id="resource-name" required value={values.name} onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))} /></div>
            {stall ? <div className="space-y-2"><Label htmlFor="resource-commission">Commission %</Label>
              <Input id="resource-commission" type="number" min={0} max={100} step="0.5" required value={values.commissionPercent}
                onChange={(e) => setValues((v) => ({ ...v, commissionPercent: e.target.value }))} /></div>
              : <div className="space-y-2"><Label htmlFor="resource-phone">Phone number (optional)</Label>
                <Input id="resource-phone" value={values.phoneNumber} onChange={(e) => setValues((v) => ({ ...v, phoneNumber: e.target.value }))} /></div>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" disabled={pending} onClick={() => setMode(null)}>Cancel</Button>
              <Button type="submit" disabled={!valid || pending}>{save.isPending ? 'Saving…' : 'Save changes'}</Button>
            </div>
          </form>}
        </DialogContent>
      </Dialog>
      {credentials && <OperatorCredentialsDialog open title={`${initial.name} — PIN`} {...credentials} onClose={() => { setCredentials(null); reveal.reset(); }} />}
    </div>
  );
}
