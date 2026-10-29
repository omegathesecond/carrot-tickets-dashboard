import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import type { Event } from '@/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export function PurchaseChargeSetting({ event }: { event: Event }) {
  const current = event.purchaseCharge;
  const [type, setType] = useState<'off' | 'fixed' | 'percentage'>(current?.type ?? 'off');
  const [value, setValue] = useState(current ? String(current.type === 'fixed' ? current.value / 100 : current.value) : '');
  const queryClient = useQueryClient();
  const number = Number(value);
  const valid = type === 'off' || (value.trim() !== '' && Number.isFinite(number) && number > 0 && /^\d+(\.\d{1,2})?$/.test(value) && number <= (type === 'fixed' ? 100000 : 100));
  const setting = type === 'off' ? null : { type, value: type === 'fixed' ? Math.round(number * 100) : number };
  const save = useMutation({
    mutationFn: () => apiClient.events.updateEvent(event._id, { purchaseCharge: setting }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', event._id] });
      toast.success('Purchase charge saved');
    },
    onError: (error: Error) => toast.error(error.message || 'Could not save purchase charge'),
  });
  const currency = event.currency === 'SZL' ? 'E' : 'R';
  const exampleCharge = number;
  return (
    <form className="space-y-3 rounded-lg border p-4" onSubmit={(e) => { e.preventDefault(); if (valid) save.mutate(); }}>
      <div>
        <h3 className="font-medium">Charge per purchase</h3>
        <p className="text-sm text-muted-foreground">Added to the customer’s total on each payment. Collected for the organizer.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="purchase-charge-type">Charge type</Label>
        <select id="purchase-charge-type" className="h-10 w-full rounded-md border bg-background px-3" value={type} disabled={save.isPending}
          onChange={(e) => { setType(e.target.value as typeof type); setValue(''); }}>
          <option value="off">No charge</option>
          <option value="fixed">Fixed amount</option>
          <option value="percentage">Percentage</option>
        </select>
      </div>
      {type !== 'off' && <div className="space-y-2">
        <Label htmlFor="purchase-charge-value">{type === 'fixed' ? `Amount (${currency})` : 'Percentage (%)'}</Label>
        <Input id="purchase-charge-value" type="number" min="0.01" max={type === 'fixed' ? 100000 : 100} step="0.01" value={value} required disabled={save.isPending} onChange={(e) => setValue(e.target.value)} />
        {valid && <p className="text-xs text-muted-foreground">A {currency}100 purchase adds {currency}{exampleCharge.toFixed(2)}. Customer pays {currency}{(100 + exampleCharge).toFixed(2)}.</p>}
      </div>}
      <Button type="submit" disabled={!valid || save.isPending}>{save.isPending ? 'Saving…' : 'Save purchase charge'}</Button>
    </form>
  );
}
