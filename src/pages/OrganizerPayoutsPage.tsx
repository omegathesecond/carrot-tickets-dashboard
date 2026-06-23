import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { DollarSign, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { type OrganizerPayoutPreview, type OrganizerPayout } from '@/types/reseller';
import { type Event } from '@/types';
import { type DateRange } from '@/components/DateRangePicker';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatsCard } from '@/components/ui/stats-card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DateRangePicker } from '@/components/DateRangePicker';

export function OrganizerPayoutsPage() {
  const [vendorId, setVendorId] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>({ startDate: undefined, endDate: undefined });
  const [preview, setPreview] = useState<OrganizerPayoutPreview | null>(null);
  const [payout, setPayout] = useState<OrganizerPayout | null>(null);
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);
  const [paymentRef, setPaymentRef] = useState('');

  const { data: eventsData, isLoading: eventsLoading, isError: eventsError } = useQuery({
    queryKey: ['events-all'],
    queryFn: () => apiClient.events.getEvents({ limit: 500 }),
  });

  useEffect(() => {
    if (eventsError) toast.error('Failed to load organizers');
  }, [eventsError]);

  // De-duplicate by vendorId
  const vendors = eventsData
    ? Array.from(
        new Map(
          eventsData.data.map((e: Event) => [e.vendorId, e.vendorId])
        ).entries()
      ).map(([id]) => id)
    : [];

  const previewMutation = useMutation({
    mutationFn: () =>
      apiClient.resellerAdmin.getVendorPayout(vendorId, dateRange.startDate!, dateRange.endDate!),
    onSuccess: (data) => {
      setPreview(data);
      setPayout(null);
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : 'Failed to load payout preview'),
  });

  const closeMutation = useMutation({
    mutationFn: () =>
      apiClient.resellerAdmin.closeVendorPayout(vendorId, dateRange.startDate!, dateRange.endDate!),
    onSuccess: (data) => {
      setPayout(data);
      toast.success('Payout period closed');
      setIsCloseConfirmOpen(false);
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : 'Failed to close payout period'),
  });

  const markPaidMutation = useMutation({
    mutationFn: () =>
      apiClient.resellerAdmin.markVendorPayoutPaid(vendorId, payout!._id, paymentRef || undefined),
    onSuccess: (data) => {
      setPayout(data);
      toast.success('Payout marked as paid');
      setPaymentRef('');
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : 'Failed to mark payout as paid'),
  });

  const canPreview = !!vendorId && !!dateRange.startDate && !!dateRange.endDate;

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Organizer Payouts</h1>

      {/* Vendor + date picker row */}
      <div className="flex flex-wrap items-end gap-4 mb-6">
        <div className="space-y-2">
          <Label htmlFor="vendor-select">Organizer</Label>
          <Select value={vendorId} onValueChange={(v) => { setVendorId(v); setPreview(null); setPayout(null); }} disabled={eventsLoading}>
            <SelectTrigger id="vendor-select" className="w-64">
              <SelectValue placeholder={eventsLoading ? 'Loading organizers…' : 'Select organizer…'} />
            </SelectTrigger>
            <SelectContent>
              {vendors.map((id) => (
                <SelectItem key={id} value={id}>
                  {id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DateRangePicker value={dateRange} onChange={(r) => { setDateRange(r); setPreview(null); setPayout(null); }} />

        <Button
          onClick={() => previewMutation.mutate()}
          disabled={!canPreview || previewMutation.isPending}
          className="bg-gradient-to-r from-orange-600 to-amber-600 text-white hover:opacity-90"
        >
          {previewMutation.isPending ? 'Loading…' : 'Preview'}
        </Button>
      </div>

      {/* Preview stats */}
      {preview && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title="Proceeds Owed"
              value={`E ${preview.proceedsOwed.toFixed(2)}`}
              description="Total organizer proceeds from ticket sales"
              icon={DollarSign}
              gradient="from-green-500 to-emerald-600"
            />
            <StatsCard
              title="Fee Owed by Vendor"
              value={`E ${preview.feeOwedByVendor.toFixed(2)}`}
              description="Platform fee the vendor owes Carrot"
              icon={TrendingDown}
              gradient="from-red-500 to-rose-600"
            />
            <StatsCard
              title="Available Proceeds"
              value={`E ${preview.availableProceeds.toFixed(2)}`}
              description="What Carrot can pay out now"
              icon={TrendingUp}
              gradient="from-blue-500 to-indigo-600"
            />
            <StatsCard
              title="Net Amount"
              value={`E ${preview.netAmount.toFixed(2)}`}
              description="Net payable to organizer"
              icon={Wallet}
              gradient="from-orange-500 to-amber-600"
            />
          </div>

          {!payout && (
            <Button
              variant="outline"
              onClick={() => setIsCloseConfirmOpen(true)}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              Close Period
            </Button>
          )}
        </div>
      )}

      {/* Mark Paid */}
      {payout && payout.status !== 'paid' && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-slate-700">
              Mark Payout as Paid
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="payout-ref">Payment Reference (optional)</Label>
              <Input
                id="payout-ref"
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                placeholder="e.g. EFT-20260601"
              />
            </div>
            <Button
              onClick={() => markPaidMutation.mutate()}
              disabled={markPaidMutation.isPending}
              className="bg-gradient-to-r from-orange-600 to-amber-600 text-white hover:opacity-90"
            >
              {markPaidMutation.isPending ? 'Processing…' : 'Mark as Paid'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Paid state */}
      {payout && payout.status === 'paid' && (
        <Card className="mt-4">
          <CardContent className="pt-4">
            <p className="text-green-700 font-medium text-sm">
              Payout marked as paid
              {payout.paymentReference ? ` — ref: ${payout.paymentReference}` : ''}.
            </p>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={isCloseConfirmOpen}
        onOpenChange={setIsCloseConfirmOpen}
        title="Close Payout Period"
        description="This will lock the payout period and create a formal payout record. This cannot be undone."
        confirmLabel="Close Period"
        isLoading={closeMutation.isPending}
        onConfirm={() => closeMutation.mutate()}
        destructive
      />
    </div>
  );
}
