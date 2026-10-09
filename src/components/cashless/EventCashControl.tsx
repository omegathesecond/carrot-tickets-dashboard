import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { formatMoney } from '@/lib/currency';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';

export function EventCashControl({ eventId }: { eventId: string }) {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['event-cash-control', eventId], queryFn: () => apiClient.cashCollections.report(eventId), refetchInterval: 5000, retry: false });
  if (error) return <div role="alert" className="text-red-600">{error.message}<Button variant="outline" onClick={() => refetch()}>Retry</Button></div>;
  if (isLoading || !data) return <p>Loading cash records…</p>;
  const money = (cents: number) => formatMoney(cents / 100, data.currency, { decimals: 2 });
  return <div className="space-y-6">
    <div><h2 className="text-xl font-semibold">Cash control</h2><p className="text-sm text-muted-foreground">Cash reloads minus cash-outs and confirmed handovers. Card payments are excluded.</p></div>
    <div className="grid gap-3 sm:grid-cols-3">
      {[['At cashier desks', money(data.cashOnHand)], ['Held by collectors', money(data.collectorHeld)], ['Awaiting confirmation', String(data.pendingCount)]].map(([label, value]) => <Card key={label}><CardContent className="pt-5"><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-bold text-primary">{value}</p></CardContent></Card>)}
    </div>
    <section><h3 className="font-semibold mb-2">Cash with each cashier</h3><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Cashier</TableHead><TableHead>Cash reloads</TableHead><TableHead>Cash-outs</TableHead><TableHead>Handed over</TableHead><TableHead>Cash on hand</TableHead></TableRow></TableHeader><TableBody>
      {data.cashiers.map(c => <TableRow key={c.id}><TableCell>{c.fullName}{!c.isActive && ' (inactive)'}</TableCell><TableCell>{money(c.cashTopups)}</TableCell><TableCell>{money(c.cashWithdrawals)}</TableCell><TableCell>{money(c.collected)}</TableCell><TableCell className={c.cashOnHand < 0 ? 'text-red-600 font-semibold' : 'font-semibold'}>{money(c.cashOnHand)}</TableCell></TableRow>)}
      {!data.cashiers.length && <TableRow><TableCell colSpan={5}>No cash activity yet.</TableCell></TableRow>}
    </TableBody></Table></div></section>
    <section><h3 className="font-semibold mb-2">Cash with each collector</h3><div className="space-y-2">{data.collectors.map(c => <div key={c.id} className="flex justify-between border rounded-lg p-3"><span>{c.fullName}</span><strong>{money(c.held)}</strong></div>)}{!data.collectors.length && <p className="text-sm text-muted-foreground">No confirmed collections yet.</p>}</div></section>
    <section><h3 className="font-semibold">Handover records</h3><p className="text-sm text-muted-foreground mb-2">Latest 100 handovers. Totals above include all confirmed collections.</p><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Cashier</TableHead><TableHead>Collector</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Requested</TableHead><TableHead>Resolved</TableHead></TableRow></TableHeader><TableBody>{data.collections.map(c => <TableRow key={c._id}><TableCell>{c.cashierName}</TableCell><TableCell>{c.collectorName}</TableCell><TableCell>{money(c.amount)}</TableCell><TableCell>{c.status === 'confirmed' ? 'Confirmed by cashier' : c.status === 'pending' ? 'Awaiting cashier' : c.status}</TableCell><TableCell>{new Date(c.createdAt).toLocaleString()}</TableCell><TableCell>{c.resolvedAt ? new Date(c.resolvedAt).toLocaleString() : '—'}</TableCell></TableRow>)}{!data.collections.length && <TableRow><TableCell colSpan={6}>No handovers yet.</TableCell></TableRow>}</TableBody></Table></div></section>
  </div>;
}
