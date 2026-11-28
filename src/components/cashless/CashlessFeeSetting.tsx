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
    ? current.tiers.map(t => ({ max: t.max === null ? '' : String(t.max / 100), fee: String(t.fee / 100) }))
    : [{ max: '', fee: '' }]);
  const queryClient = useQueryClient();
  const currency = event.currency === 'SZL' ? 'E' : 'R';
  let setting: CashlessFee | null = null;
  let valid = type === 'off';
  if (type === 'fixed' || type === 'percentage') {
    const parsed = type === 'fixed' ? cents(value) : decimal(value);
    valid = decimalPattern.test(value) && Number.isFinite(parsed) && parsed > 0 && parsed <= (type === 'fixed' ? 10000000 : 100);
    setting = { type, value: parsed };
  } else if (type === 'tiered') {
    const rows = tiers.map((t, i) => ({ min: i === 0 ? 0 : cents(tiers[i - 1]!.max), max: i === tiers.length - 1 && t.max === '' ? null : cents(t.max), fee: cents(t.fee) }));
    valid = rows[rows.length - 1]!.max === null && rows.every(t => Number.isFinite(t.min) && (t.max === null || Number.isFinite(t.max) && t.max > t.min) && Number.isFinite(t.fee));
    setting = { type: 'tiered', tiers: rows };
  }
  const save = useMutation({
    mutationFn: () => apiClient.events.updateEvent(event._id, { [field]: setting }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['event', event._id] }); toast.success(`${label} saved`); },
    onError: (error: Error) => toast.error(error.message || `Could not save ${label.toLowerCase()}`),
  });
  const updateTier = (index: number, key: 'max' | 'fee', text: string) => setTiers(rows => {
    const updated = rows.map((row, i) => i === index ? { ...row, [key]: text } : row);
    // Typing a limit on the final row starts the next adjoining range. Keep
    // the same input mounted so mobile keyboards retain focus and draft text.
    if (key === 'max' && text !== '' && index === rows.length - 1 && rows.length < 50) updated.push({ max: '', fee: '' });
    return updated;
  });
  return <form className="space-y-4 rounded-lg border p-4" onSubmit={e => { e.preventDefault(); if (valid) save.mutate(); }}>
    <div><h3 className="font-medium">{withdrawal ? label : 'Charge per purchase'}</h3>
      <p className="text-sm text-muted-foreground">{withdrawal ? 'Deducted from each withdrawal. Applies to cashier cash-outs, office refunds and post-event tag withdrawals. Collected for the organizer.' : 'Added to the customer’s total on each payment. Collected for the organizer.'}</p></div>
    <div className="space-y-2"><Label htmlFor={`${field}-type`}>{label} type</Label>
      <select id={`${field}-type`} className="h-10 w-full rounded-md border bg-background px-3" value={type} disabled={save.isPending} onChange={e => { setType(e.target.value as typeof type); setValue(''); }}>
        <option value="off">No charge</option><option value="fixed">Fixed amount</option><option value="percentage">Percentage</option><option value="tiered">Amount tiers</option>
      </select></div>
    {(type === 'fixed' || type === 'percentage') && <div className="space-y-2"><Label htmlFor={`${field}-value`}>{type === 'fixed' ? `Amount (${currency})` : 'Percentage (%)'}</Label>
      <Input id={`${field}-value`} type="text" inputMode="decimal" pattern="[0-9]+([.,][0-9]{1,2})?" value={value} required disabled={save.isPending} onChange={e => setValue(e.target.value)} /></div>}
    {type === 'tiered' && <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Type a fee and an upper limit for each range. Adding a limit starts the next tier automatically. “From” updates for you. Leave the last limit blank for no limit. Enter 0 for a free tier.</p>
      {tiers.map((tier, i) => <fieldset key={i} disabled={save.isPending} className="grid grid-cols-3 gap-2 rounded-md bg-muted/40 p-3">
        <div className="space-y-1"><Label htmlFor={`${field}-min-${i}`}>From ({currency})</Label><output id={`${field}-min-${i}`} className="flex h-9 items-center px-1 text-sm tabular-nums">{i === 0 ? '0.00' : tiers[i - 1]!.max || '—'}</output></div>
        <div className="space-y-1"><Label htmlFor={`${field}-max-${i}`}>Below ({currency})</Label><Input id={`${field}-max-${i}`} type="text" inputMode="decimal" pattern="[0-9]+([.,][0-9]{1,2})?" placeholder={i === tiers.length - 1 ? 'No limit' : 'e.g. 100.00'} value={tier.max} onChange={e => updateTier(i, 'max', e.target.value)} required={i < tiers.length - 1} /></div>
        <div className="space-y-1"><Label htmlFor={`${field}-fee-${i}`}>Fee ({currency})</Label><Input id={`${field}-fee-${i}`} type="text" inputMode="decimal" pattern="[0-9]+([.,][0-9]{1,2})?" placeholder="e.g. 2.50" value={tier.fee} onChange={e => updateTier(i, 'fee', e.target.value)} required /></div>
        {tiers.length > 1 && <Button type="button" variant="ghost" size="sm" className="col-span-3 justify-self-end" onClick={() => setTiers(rows => rows.filter((_, index) => index !== i))}>Remove tier {i + 1}</Button>}
      </fieldset>)}
      <Button type="button" variant="outline" disabled={save.isPending || tiers.length >= 50} onClick={() => setTiers(rows => [...rows, { max: '', fee: '' }])}>Add tier</Button>
    </div>}
    {!valid && <p className="text-sm text-destructive" role="status">{type === 'tiered' ? 'Enter increasing range limits and a fee for every tier.' : 'Enter a valid positive amount or percentage.'}</p>}
    {withdrawal && type !== 'off' && <p className="text-xs text-muted-foreground">Withdrawals must be greater than the fee. The attendee receives the withdrawal amount minus this fee.</p>}
    <Button type="submit" disabled={!valid || save.isPending}>{save.isPending ? 'Saving…' : `Save ${label.toLowerCase()}`}</Button>
  </form>;
}
