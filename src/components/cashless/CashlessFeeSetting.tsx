import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import type { Event, CashlessFee } from '@/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

const decimalPattern = /^\d+([.,]\d{1,2})?$/;
const decimal = (text: string) => Number(text.replace(',', '.'));
const cents = (text: string) => decimalPattern.test(text) && decimal(text) <= 100000 ? Math.round(decimal(text) * 100) : NaN;
export function CashlessFeeSetting({ event, field }: { event: Event; field: 'purchaseCharge' | 'withdrawalFee' }) {
  const current = event[field];
  const withdrawal = field === 'withdrawalFee';
  const label = withdrawal ? 'Withdrawal fee' : 'Purchase charge';
  const [type, setType] = useState<'off' | CashlessFee['type']>(current?.type ?? 'off');
  const [value, setValue] = useState(current && current.type !== 'tiered' ? String(current.type === 'fixed' ? current.value / 100 : current.value) : '');
  const [tiers, setTiers] = useState(current?.type === 'tiered'
    ? current.tiers.map(t => ({ max: t.max === null ? '' : ((t.max - 1) / 100).toFixed(2), fee: String(t.fee / 100) }))
    : [{ max: '', fee: '' }]);
  const [submitError, setSubmitError] = useState('');
  const [saved, setSaved] = useState(false);
  const queryClient = useQueryClient();
  const currency = event.currency === 'SZL' ? 'E' : 'R';
  let setting: CashlessFee | null = null;
  let valid = type === 'off';
  if (type === 'fixed' || type === 'percentage') {
    const parsed = type === 'fixed' ? cents(value) : decimal(value);
    valid = decimalPattern.test(value) && Number.isFinite(parsed) && parsed > 0 && parsed <= (type === 'fixed' ? 10000000 : 100);
    setting = { type, value: parsed };
  } else if (type === 'tiered') {
    const rows = tiers.map((t, i) => ({ min: i === 0 ? 0 : cents(tiers[i - 1]!.max) + 1, max: i === tiers.length - 1 && t.max === '' ? null : cents(t.max) + 1, fee: cents(t.fee) }));
    valid = rows[rows.length - 1]!.max === null && rows.every(t => Number.isFinite(t.min) && (t.max === null || Number.isFinite(t.max) && t.max > t.min && t.max <= 10000000) && Number.isFinite(t.fee));
    setting = { type: 'tiered', tiers: rows };
  }
  const save = useMutation({
    mutationFn: () => apiClient.events.updateEvent(event._id, { [field]: setting }),
    onSuccess: () => { setSaved(true); setSubmitError(''); queryClient.invalidateQueries({ queryKey: ['event', event._id] }); toast.success(`${label} saved`); },
    onError: (error: Error) => { const message = error.message || `Could not save ${label.toLowerCase()}`; setSubmitError(message); toast.error(message); },
  });
  const updateTier = (index: number, key: 'max' | 'fee', text: string) => {
    setSaved(false);
    setTiers(rows => rows.map((row, i) => i === index ? { ...row, [key]: text } : row));
  };
  const submit = () => {
    setSaved(false);
    if (!valid) {
      let message = 'Enter a valid positive amount or percentage (up to 100%).';
      if (type === 'tiered') {
        message = '';
        for (let i = 0; i < tiers.length; i++) {
          const tier = tiers[i]!;
          const start = i === 0 ? 0 : cents(tiers[i - 1]!.max) + 1;
          if (!Number.isFinite(cents(tier.fee))) { message = `Tier ${i + 1}: enter a fee with up to two decimal places. Enter 0 for no fee.`; break; }
          if (tier.max === '' && i < tiers.length - 1) { message = `Tier ${i + 1}: enter the To amount before the next tier.`; break; }
          if (tier.max !== '' && (!Number.isFinite(cents(tier.max)) || cents(tier.max) < start)) { message = `Tier ${i + 1}: the To amount must be at least ${(start / 100).toFixed(2)}, with up to two decimal places.`; break; }
        }
        if (!message) message = 'Add a final tier for higher amounts and leave its To amount blank (and above), or clear the last To amount.';
      }
      setSubmitError(message);
      toast.error(message);
      return;
    }
    setSubmitError('');
    save.mutate();
  };
  return <form noValidate className="space-y-4 rounded-lg border p-4" onChange={() => setSaved(false)} onSubmit={e => { e.preventDefault(); submit(); }}>
    <div><h3 className="font-medium">{withdrawal ? label : 'Charge per purchase'}</h3>
      <p className="text-sm text-muted-foreground">{withdrawal ? 'Deducted from each withdrawal. Applies to cashier cash-outs, office refunds and post-event tag withdrawals. Collected for the organizer.' : 'Added to the customer’s total on each payment. Collected for the organizer.'}</p></div>
    <div className="space-y-2"><Label htmlFor={`${field}-type`}>{label} type</Label>
      <select id={`${field}-type`} className="h-10 w-full rounded-md border bg-background px-3" value={type} disabled={save.isPending} onChange={e => { setType(e.target.value as typeof type); setValue(''); }}>
        <option value="off">No charge</option><option value="fixed">Fixed amount</option><option value="percentage">Percentage</option><option value="tiered">Amount tiers</option>
      </select></div>
    {(type === 'fixed' || type === 'percentage') && <div className="space-y-2"><Label htmlFor={`${field}-value`}>{type === 'fixed' ? `Amount (${currency})` : 'Percentage (%)'}</Label>
      <Input id={`${field}-value`} type="text" inputMode="decimal" pattern="[0-9]+([.,][0-9]{1,2})?" value={value} required disabled={save.isPending} onChange={e => setValue(e.target.value)} /></div>}
    {type === 'tiered' && <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Fill in To and Fee, then use Add tier if you need another range. To includes the amount you enter: 20.00 is followed by 20.01. Leave the final To blank for “and above”. Enter 0 for a free tier.</p>
      {tiers.map((tier, i) => <fieldset key={i} disabled={save.isPending} className="grid grid-cols-3 gap-2 rounded-md bg-muted/40 p-3">
        <div className="space-y-1"><Label htmlFor={`${field}-min-${i}`}>From ({currency})</Label><output id={`${field}-min-${i}`} className="flex h-9 items-center px-1 text-sm tabular-nums">{i === 0 ? '0.00' : Number.isFinite(cents(tiers[i - 1]!.max)) ? ((cents(tiers[i - 1]!.max) + 1) / 100).toFixed(2) : '—'}</output></div>
        <div className="space-y-1"><Label htmlFor={`${field}-max-${i}`}>To ({currency})</Label><Input id={`${field}-max-${i}`} type="text" inputMode="decimal" pattern="[0-9]+([.,][0-9]{1,2})?" placeholder={i === tiers.length - 1 ? 'And above' : 'e.g. 100.00'} value={tier.max} onChange={e => updateTier(i, 'max', e.target.value)} required={i < tiers.length - 1} /></div>
        <div className="space-y-1"><Label htmlFor={`${field}-fee-${i}`}>Fee ({currency})</Label><Input id={`${field}-fee-${i}`} type="text" inputMode="decimal" pattern="[0-9]+([.,][0-9]{1,2})?" placeholder="e.g. 2.50" value={tier.fee} onChange={e => updateTier(i, 'fee', e.target.value)} required /></div>
        {tiers.length > 1 && <Button type="button" variant="ghost" size="sm" className="col-span-3 justify-self-end" onClick={() => setTiers(rows => rows.filter((_, index) => index !== i))}>Remove tier {i + 1}</Button>}
      </fieldset>)}
      <Button type="button" variant="outline" disabled={save.isPending || tiers.length >= 50} onClick={() => { setSaved(false); setTiers(rows => [...rows, { max: '', fee: '' }]); }}>Add tier</Button>
    </div>}
    {submitError && <p className="text-sm text-destructive" role="alert">{submitError}</p>}
    {saved && <p className="text-sm text-green-700" role="status">{label} saved.</p>}
    {withdrawal && type !== 'off' && <p className="text-xs text-muted-foreground">Withdrawals must be greater than the fee. The attendee receives the withdrawal amount minus this fee.</p>}
    <Button type="submit" disabled={save.isPending}>{save.isPending ? 'Saving…' : `Save ${label.toLowerCase()}`}</Button>
  </form>;
}
