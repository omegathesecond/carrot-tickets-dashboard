import { BANK_FIELDS, maskPayoutAccount } from '@/lib/payoutBank';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { formatMoney } from '@/lib/currency';
import type { PayoutBank } from '@/types/eventPayout';
import { BankSummary, PayoutSummary, PayoutHistory } from './PayoutSummary';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';

const EMPTY: PayoutBank = {
  country: '',
  bank: '',
  accountType: '',
  branchCode: '',
  accountHolder: '',
  accountNumber: '',
};
export function EventPayoutPanel({ eventId }: { eventId: string }) {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [bank, setBank] = useState<PayoutBank>(EMPTY);
  const [useSaved, setUseSaved] = useState(true);
  const [saveBank, setSaveBank] = useState(true);
  const [confirmation, setConfirmation] = useState<{
    bank: PayoutBank;
    useSaved: boolean;
    saveBank: boolean;
    expectedAmount: number;
    bankVersion?: string;
  } | null>(null);
  const confirm = confirmation !== null;
  const overview = useQuery({
    queryKey: ['event-payout', eventId],
    queryFn: () => apiClient.payoutRequests.overview(eventId),
  });
  const saved = useQuery({
    queryKey: ['payout-bank'],
    queryFn: () => apiClient.payoutRequests.bank(),
    enabled: open,
  });
  const hasSaved = useSaved && !!saved.data;
  const displayBank = confirmation
    ? {
        ...confirmation.bank,
        accountNumber: confirmation.useSaved
          ? confirmation.bank.accountNumber
          : maskPayoutAccount(confirmation.bank.accountNumber),
      }
    : { ...EMPTY };
  const request = useMutation({
    mutationFn: () => {
      if (!confirmation)
        throw new Error('Review your bank details before submitting');
      return apiClient.payoutRequests.request(
        eventId,
        confirmation.useSaved
          ? {
              useSaved: true,
              bankVersion: confirmation.bankVersion,
              expectedAmount: confirmation.expectedAmount,
            }
          : {
              bank: confirmation.bank,
              saveBank: confirmation.saveBank,
              expectedAmount: confirmation.expectedAmount,
            },
      );
    },
    onSuccess: () => {
      setOpen(false);
      setBank(EMPTY);
      setConfirmation(null);
      void client.invalidateQueries({ queryKey: ['event-payout', eventId] });
      void client.invalidateQueries({ queryKey: ['payout-bank'] });
      toast.success('Payout request sent to Carrot for review');
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setConfirmation(null);
      void client.invalidateQueries({ queryKey: ['event-payout', eventId] });
      void client.invalidateQueries({ queryKey: ['payout-bank'] });
    },
  });
  const forget = useMutation({
    mutationFn: () => apiClient.payoutRequests.forgetBank(),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['payout-bank'] });
      setUseSaved(false);
      toast.success('Saved bank details removed');
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (overview.isPending) return <p role="status">Loading payout balance…</p>;
  if (overview.isError)
    return (
      <p role="alert" className="text-red-700">
        Could not load payout balance: {overview.error.message}{' '}
        <Button variant="outline" onClick={() => void overview.refetch()}>
          Retry
        </Button>
      </p>
    );
  const data = overview.data;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Event payout</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <PayoutSummary breakdown={data.breakdown} currency={data.currency} />
        <Button
          disabled={!data.eligible}
          onClick={() => {
            setOpen(true);
            setConfirmation(null);
            setBank(EMPTY);
            setUseSaved(true);
          }}
        >
          Request Payout
        </Button>
        {data.reason && <p className="text-sm text-slate-600">{data.reason}</p>}
        {data.requests.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-semibold">Payout history</h3>
            {data.requests.map((p) => (
              <div key={p._id} className="rounded-lg border p-4 space-y-3">
                <p>
                  <span className="capitalize font-medium">{p.status}</span> ·{' '}
                  {formatMoney(p.amount, p.currency, { decimals: 2 })} ·
                  Requested {new Date(p.createdAt).toLocaleString()}
                </p>
                <BankSummary bank={p.bank} />
                <PayoutHistory request={p} />
              </div>
            ))}
          </div>
        )}
        <Dialog
          open={open}
          onOpenChange={(value) => {
            if (!request.isPending) {
              setOpen(value);
              setConfirmation(null);
              setBank(EMPTY);
            }
          }}
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {confirm ? 'Confirm payout request' : 'Payout bank details'}
              </DialogTitle>
              <DialogDescription>
                {data.eventName} ·{' '}
                {formatMoney(
                  confirmation?.expectedAmount ??
                    data.breakdown.availableBalance,
                  data.currency,
                  {
                    decimals: 2,
                  },
                )}
                . Carrot will review your request before payment.
              </DialogDescription>
            </DialogHeader>
            {saved.isPending ? (
              <p role="status">Loading saved bank details…</p>
            ) : saved.isError ? (
              <p role="alert">
                Could not load saved bank details.{' '}
                <Button onClick={() => void saved.refetch()}>Retry</Button>
              </p>
            ) : confirm ? (
              <div className="space-y-4">
                <BankSummary bank={displayBank} />
                <p className="text-sm">
                  Check the bank and account ending above before submitting.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    disabled={request.isPending}
                    onClick={() => setConfirmation(null)}
                  >
                    Edit details
                  </Button>
                  <Button
                    disabled={request.isPending || !data.eligible}
                    onClick={() => request.mutate()}
                  >
                    {request.isPending
                      ? 'Submitting…'
                      : 'Submit payout request'}
                  </Button>
                </div>
              </div>
            ) : (
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  setConfirmation({
                    bank: hasSaved ? saved.data! : { ...bank },
                    useSaved: hasSaved,
                    saveBank,
                    expectedAmount: data.breakdown.availableBalance,
                    bankVersion: saved.data?.version,
                  });
                }}
              >
                {saved.data && (
                  <div className="space-y-3">
                    <label className="flex gap-2 items-center">
                      <input
                        type="checkbox"
                        checked={useSaved}
                        onChange={(e) => setUseSaved(e.target.checked)}
                      />
                      Reuse saved bank details
                    </label>
                    {hasSaved && <BankSummary bank={saved.data} />}
                    <Button
                      type="button"
                      variant="outline"
                      disabled={forget.isPending}
                      onClick={() => forget.mutate()}
                    >
                      Remove saved details
                    </Button>
                  </div>
                )}
                {!hasSaved && (
                  <>
                    <div className="grid sm:grid-cols-2 gap-4">
                      {BANK_FIELDS.map(({ key, label }) => (
                        <div className="space-y-1" key={key}>
                          <Label htmlFor={`payout-${key}`}>{label}</Label>
                          <Input
                            id={`payout-${key}`}
                            required
                            value={bank[key]}
                            autoComplete="off"
                            maxLength={
                              key === 'accountNumber'
                                ? 34
                                : key === 'branchCode'
                                  ? 20
                                  : 120
                            }
                            minLength={
                              key === 'accountNumber'
                                ? 4
                                : key === 'branchCode'
                                  ? 2
                                  : 1
                            }
                            pattern={
                              key === 'accountNumber'
                                ? '[0-9]{4,34}'
                                : key === 'branchCode'
                                  ? '[a-zA-Z0-9 \\-]{2,20}'
                                  : '.*\\S.*'
                            }
                            inputMode={
                              key === 'accountNumber' ? 'numeric' : 'text'
                            }
                            onChange={(e) =>
                              setBank((b) => ({ ...b, [key]: e.target.value }))
                            }
                          />
                        </div>
                      ))}
                    </div>
                    <label className="flex gap-2 items-center">
                      <input
                        type="checkbox"
                        checked={saveBank}
                        onChange={(e) => setSaveBank(e.target.checked)}
                      />
                      Save these bank details for future payouts
                      {saved.data ? ' (replaces saved details)' : ''}
                    </label>
                  </>
                )}
                <Button type="submit">Review masked account</Button>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
