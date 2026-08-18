import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CreditCard, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TransactionDetailDialog, type TxnDetail } from '@/components/TransactionDetailDialog';

const fmtR = (c: number) => `R${((c ?? 0) / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtTime = (iso: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('en-ZA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};
const bandRef = (uid: string) => (!uid ? '—' : `••${(uid.length > 6 ? uid.slice(-6) : uid).toUpperCase()}`);

/**
 * One stall's takings, reached from its event's Cashless > Stalls tab. The
 * route carries both ids (/events/:id/stalls/:merchantId) because a merchant
 * belongs to exactly one event — the event id is what makes the URL, and the
 * back link, honest about where this stall lives.
 */
export function StallDetailPage() {
  const { id = '', merchantId = '' } = useParams();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<TxnDetail | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['stall-detail', merchantId],
    queryFn: () => apiClient.merchants.transactions(merchantId),
    retry: false,
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <Button variant="ghost" size="sm" className="text-slate-500"
          onClick={() => navigate(`/events/${id}?tab=cashless&sub=stalls`)}>
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Stalls
        </Button>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
          </div>
        ) : error || !data ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Could not load this stall.</CardContent></Card>
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
                      <div
                        key={t.id}
                        className="flex items-center gap-3 py-3 cursor-pointer hover:bg-slate-50 -mx-2 px-2 rounded"
                        onClick={() => setSelected({
                          id: t.id, type: 'purchase', amount: t.amount, at: t.createdAt,
                          actorName: data.merchant.name, actorType: 'Merchant',
                          bandUid: t.bandUid, fee: t.fee, netAmount: t.netAmount, status: t.status || 'completed',
                        })}
                      >
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
      <TransactionDetailDialog txn={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
