import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CreditCard, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const fmtR = (c: number) => `R${((c ?? 0) / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtTime = (iso: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('en-ZA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};
const bandRef = (uid: string) => (!uid ? '—' : `••${(uid.length > 6 ? uid.slice(-6) : uid).toUpperCase()}`);

export function VendorDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ['vendor-detail', id],
    queryFn: () => apiClient.merchants.transactions(id),
    retry: false,
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <Button variant="ghost" size="sm" className="text-slate-500" onClick={() => navigate('/vendors')}>
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Vendors
        </Button>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
          </div>
        ) : error || !data ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Could not load this vendor.</CardContent></Card>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{data.merchant.name}</h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  Login <span className="font-mono text-slate-700">{data.merchant.loginCode}</span>
                  {' · '}{data.merchant.commissionPercent}% commission
                  {data.event?.name ? ` · ${data.event.name}` : ''}
                </p>
              </div>
              <Badge variant={data.merchant.status === 'active' ? 'default' : 'secondary'}>
                {data.merchant.status === 'active' ? 'Active' : 'Disabled'}
              </Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card><CardContent className="pt-6">
                <div className="text-xs font-medium text-slate-500">Charged</div>
                <div className="text-2xl font-bold mt-1">{fmtR(data.summary.totalCharged)}</div>
              </CardContent></Card>
              <Card><CardContent className="pt-6">
                <div className="text-xs font-medium text-green-600">Net owed</div>
                <div className="text-2xl font-bold mt-1">{fmtR(data.summary.totalNet)}</div>
              </CardContent></Card>
              <Card><CardContent className="pt-6">
                <div className="text-xs font-medium text-slate-500">Commission</div>
                <div className="text-2xl font-bold mt-1">{fmtR(data.summary.totalFee)}</div>
              </CardContent></Card>
              <Card><CardContent className="pt-6">
                <div className="text-xs font-medium text-slate-500">Charges</div>
                <div className="text-2xl font-bold mt-1">{data.summary.count}</div>
              </CardContent></Card>
            </div>

            <Card>
              <CardContent className="pt-6">
                <h2 className="text-base font-semibold mb-3">Charges</h2>
                {data.transactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">No charges yet.</p>
                ) : (
                  <div className="divide-y">
                    {data.transactions.map((t) => (
                      <div key={t.id} className="flex items-center gap-3 py-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                          <CreditCard className="h-4 w-4" />
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900">{fmtR(t.amount)}</p>
                          <p className="text-xs text-slate-500">
                            Net {fmtR(t.netAmount)}{t.fee > 0 ? ` · Fee ${fmtR(t.fee)}` : ''} · {bandRef(t.bandUid)} · {fmtTime(t.createdAt)}
                          </p>
                        </div>
                        <Badge variant="secondary" className="bg-green-100 text-green-800">{t.status || 'completed'}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
