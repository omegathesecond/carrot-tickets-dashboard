import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowDownCircle, ArrowUpCircle, Loader2 } from 'lucide-react';
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

export function CashierDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<TxnDetail | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['cashier-detail', id],
    queryFn: () => apiClient.cashiers.transactions(id),
    retry: false,
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <Button variant="ghost" size="sm" className="text-slate-500" onClick={() => navigate('/cashiers')}>
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Cashiers
        </Button>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
          </div>
        ) : error || !data ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Could not load this cashier.</CardContent></Card>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{data.cashier.fullName}</h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  User ID <span className="font-mono text-slate-700">{data.cashier.loginCode}</span>
                  {data.cashier.phoneNumber ? ` · ${data.cashier.phoneNumber}` : ''}
                </p>
              </div>
              <Badge variant={data.cashier.isActive ? 'default' : 'secondary'}>
                {data.cashier.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <Card><CardContent className="pt-6">
                <div className="flex items-center gap-1.5 text-xs font-medium text-green-600"><ArrowUpCircle className="h-4 w-4" /> Topped up</div>
                <div className="text-2xl font-bold mt-1">{fmtR(data.summary.toppedUp)}</div>
              </CardContent></Card>
              <Card><CardContent className="pt-6">
                <div className="flex items-center gap-1.5 text-xs font-medium text-orange-600"><ArrowDownCircle className="h-4 w-4" /> Cashed out</div>
                <div className="text-2xl font-bold mt-1">{fmtR(data.summary.withdrawn)}</div>
              </CardContent></Card>
              <Card><CardContent className="pt-6">
                <div className="text-xs font-medium text-slate-500">Transactions</div>
                <div className="text-2xl font-bold mt-1">{data.summary.count}</div>
              </CardContent></Card>
            </div>

            <Card>
              <CardContent className="pt-6">
                <h2 className="text-base font-semibold mb-3">Transactions</h2>
                {data.transactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">No transactions yet.</p>
                ) : (
                  <div className="divide-y">
                    {data.transactions.map((t) => {
                      const isTopup = t.type === 'topup';
                      return (
                        <div
                          key={t.id}
                          className="flex items-center gap-3 py-3 cursor-pointer hover:bg-slate-50 -mx-2 px-2 rounded"
                          onClick={() => setSelected({
                            id: t.id, type: t.type, amount: t.amount, at: t.at,
                            actorName: data.cashier.fullName, actorType: 'Cashier', status: t.status || 'completed',
                          })}
                        >
                          <span className={`flex h-9 w-9 items-center justify-center rounded-full ${isTopup ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                            {isTopup ? <ArrowUpCircle className="h-4 w-4" /> : <ArrowDownCircle className="h-4 w-4" />}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className={`font-semibold ${isTopup ? 'text-green-700' : 'text-orange-700'}`}>
                              {isTopup ? '+' : '−'}{fmtR(t.amount)}
                            </p>
                            <p className="text-xs text-slate-500">{isTopup ? 'Top-up' : 'Cash-out'} · {fmtTime(t.at)}</p>
                          </div>
                          <Badge variant="secondary" className="bg-green-100 text-green-800">{t.status || 'completed'}</Badge>
                        </div>
                      );
                    })}
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
