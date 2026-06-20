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
import { toast } from 'sonner';

export function SettingsPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: () => apiClient.settings.getPaymentMethods(),
  });

  const mutation = useMutation({
    mutationFn: (patch: { keshlessWalletEnabled: boolean; mtnMomoEnabled: boolean }) =>
      apiClient.settings.updatePaymentMethods(patch),
    onSuccess: (d) => {
      qc.setQueryData(['payment-methods'], d);
      toast.success('Payment methods updated');
    },
    onError: (e: any) => toast.error(e.message || 'Update failed'),
  });

  if (isLoading || !data) return <div className="p-6">Loading…</div>;

  const toggle = (key: 'keshlessWalletEnabled' | 'mtnMomoEnabled') =>
    mutation.mutate({ ...data, [key]: !data[key] });

  return (
    <div className="p-6 max-w-2xl">
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
        </CardContent>
      </Card>
    </div>
  );
}
