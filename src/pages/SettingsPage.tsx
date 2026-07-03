import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Switch } from '@/components/ui/switch';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function SettingsPage() {
  const qc = useQueryClient();
  const [feeInput, setFeeInput] = useState('');
  const [commInput, setCommInput] = useState('');
  const [keshFeeInput, setKeshFeeInput] = useState('');
  const [momoFeeInput, setMomoFeeInput] = useState('');
  const [cardFeeInput, setCardFeeInput] = useState('');
  const [feesInitialised, setFeesInitialised] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: () => apiClient.settings.getPaymentMethods(),
  });

  // Pre-fill fee inputs once on first data load
  useEffect(() => {
    if (data && !feesInitialised) {
      setFeeInput(String(data.platformFeePercent));
      setCommInput(String(data.defaultResellerCommissionPercent));
      setKeshFeeInput(String(data.keshlessServiceFee ?? 0));
      setMomoFeeInput(String(data.momoServiceFee ?? 0));
      setCardFeeInput(String(data.cardServiceFee ?? 0));
      setFeesInitialised(true);
    }
  }, [data, feesInitialised]);

  const mutation = useMutation({
    mutationFn: (patch: Parameters<typeof apiClient.settings.updatePaymentMethods>[0]) =>
      apiClient.settings.updatePaymentMethods(patch),
    onSuccess: (d) => {
      qc.setQueryData(['payment-methods'], d);
      toast.success('Payment methods updated');
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Update failed'),
  });

  const feesMutation = useMutation({
    mutationFn: (patch: Parameters<typeof apiClient.settings.updatePaymentMethods>[0]) =>
      apiClient.settings.updatePaymentMethods(patch),
    onSuccess: (d) => {
      qc.setQueryData(['payment-methods'], d);
      toast.success('Platform fees updated');
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Update failed'),
  });

  if (isLoading) return <div className="p-6">Loading…</div>;
  if (isError || !data)
    return (
      <div className="p-6 max-w-2xl">
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive font-medium">
              Failed to load payment settings. Please retry.
            </p>
            <button
              className="mt-4 text-sm underline text-primary"
              onClick={() => refetch()}
            >
              Retry
            </button>
          </CardContent>
        </Card>
      </div>
    );

  const toggle = (key: 'keshlessWalletEnabled' | 'mtnMomoEnabled' | 'cashEnabled' | 'cardEnabled') => {
    const feeVal = parseFloat(feeInput);
    const commVal = parseFloat(commInput);
    mutation.mutate({
      ...data,
      platformFeePercent: !isNaN(feeVal) ? feeVal : data.platformFeePercent,
      defaultResellerCommissionPercent: !isNaN(commVal) ? commVal : data.defaultResellerCommissionPercent,
      [key]: !data[key],
    });
  };

  const feeVal = parseFloat(feeInput);
  const commVal = parseFloat(commInput);
  const feesValid =
    feeInput !== '' &&
    commInput !== '' &&
    !isNaN(feeVal) &&
    !isNaN(commVal) &&
    feeVal >= 0 &&
    feeVal <= 100 &&
    commVal >= 0 &&
    commVal <= 100;

  const saveFees = () => {
    feesMutation.mutate({
      ...data,
      platformFeePercent: feeVal,
      defaultResellerCommissionPercent: commVal,
    });
  };

  // Buyer-paid service fees (per online method).
  const serviceFeesMutation = useMutation({
    mutationFn: (patch: Parameters<typeof apiClient.settings.updatePaymentMethods>[0]) =>
      apiClient.settings.updatePaymentMethods(patch),
    onSuccess: (d) => {
      qc.setQueryData(['payment-methods'], d);
      toast.success('Service fees updated');
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Update failed'),
  });

  const keshFeeVal = parseFloat(keshFeeInput);
  const momoFeeVal = parseFloat(momoFeeInput);
  const cardFeeVal = parseFloat(cardFeeInput);
  const inRange = (v: number) => !isNaN(v) && v >= 0 && v <= 100000;
  const serviceFeesValid =
    keshFeeInput !== '' && momoFeeInput !== '' && cardFeeInput !== '' &&
    inRange(keshFeeVal) && inRange(momoFeeVal) && inRange(cardFeeVal);

  const saveServiceFees = () => {
    serviceFeesMutation.mutate({
      ...data,
      keshlessServiceFee: keshFeeVal,
      momoServiceFee: momoFeeVal,
      cardServiceFee: cardFeeVal,
    });
  };

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle>Payment Methods</CardTitle>
          <CardDescription>
            Choose which payment options buyers see at checkout.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">Keshless Wallet</Label>
              <p className="text-sm text-muted-foreground">Pay by Keshless card/NFC.</p>
            </div>
            <Switch
              checked={data.keshlessWalletEnabled}
              onCheckedChange={() => toggle('keshlessWalletEnabled')}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">MTN MoMo</Label>
              <p className="text-sm text-muted-foreground">
                Pay by MTN Mobile Money (approve on phone).
              </p>
            </div>
            <Switch
              checked={data.mtnMomoEnabled}
              onCheckedChange={() => toggle('mtnMomoEnabled')}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">Card payments (Peach)</Label>
              <p className="text-sm text-muted-foreground">
                Pay by Visa/Mastercard. Leave OFF until Peach activation is confirmed.
              </p>
            </div>
            <Switch
              checked={data.cardEnabled}
              onCheckedChange={() => toggle('cardEnabled')}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">Cash</Label>
              <p className="text-sm text-muted-foreground">
                Accept cash payments at point of sale.
              </p>
            </div>
            <Switch
              checked={data.cashEnabled}
              onCheckedChange={() => toggle('cashEnabled')}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Platform Fees</CardTitle>
          <CardDescription>
            Configure platform and reseller commission percentages.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="platform-fee">Platform fee %</Label>
            <Input
              id="platform-fee"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={feeInput}
              onChange={(e) => setFeeInput(e.target.value)}
              placeholder="e.g. 5"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reseller-comm">Default reseller commission %</Label>
            <Input
              id="reseller-comm"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={commInput}
              onChange={(e) => setCommInput(e.target.value)}
              placeholder="e.g. 10"
            />
          </div>
          <Button
            onClick={saveFees}
            disabled={!feesValid || feesMutation.isPending}
            className="bg-gradient-to-r from-orange-600 to-amber-600 text-white hover:opacity-90"
          >
            {feesMutation.isPending ? 'Saving…' : 'Save Fees'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Service Fees</CardTitle>
          <CardDescription>
            Flat buyer-paid fee (in E) added on top of the ticket price at online
            checkout, per payment method. Set 0 for no fee. Does not apply to
            POS/reseller sales.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="kesh-fee">Keshless Wallet service fee (E)</Label>
            <Input
              id="kesh-fee"
              type="number"
              min="0"
              step="0.01"
              value={keshFeeInput}
              onChange={(e) => setKeshFeeInput(e.target.value)}
              placeholder="e.g. 0"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="momo-fee">MTN MoMo service fee (E)</Label>
            <Input
              id="momo-fee"
              type="number"
              min="0"
              step="0.01"
              value={momoFeeInput}
              onChange={(e) => setMomoFeeInput(e.target.value)}
              placeholder="e.g. 5"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="card-fee">Card service fee (E)</Label>
            <Input
              id="card-fee"
              type="number"
              min="0"
              step="0.01"
              value={cardFeeInput}
              onChange={(e) => setCardFeeInput(e.target.value)}
              placeholder="e.g. 10"
            />
          </div>
          <Button
            onClick={saveServiceFees}
            disabled={!serviceFeesValid || serviceFeesMutation.isPending}
            className="bg-gradient-to-r from-orange-600 to-amber-600 text-white hover:opacity-90"
          >
            {serviceFeesMutation.isPending ? 'Saving…' : 'Save Service Fees'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
