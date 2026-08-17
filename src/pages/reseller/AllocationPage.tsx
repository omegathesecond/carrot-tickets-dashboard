import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { resellerApi } from '@/lib/resellerApi';
import { useResellerAuth } from '@/contexts/ResellerAuthContext';
import { Button } from '@/components/ui/button';
import { formatMoney, type Currency } from '@/lib/currency';

const money = (n: number, currency: Currency = 'SZL') =>
  formatMoney(n, currency, { decimals: 0 });

/**
 * DeltaPay's (and any allocation reseller's) single, read-only view: the ticket
 * blocks they pre-bought — sold / remaining / collected. Deliberately minimal:
 * no sidebar, no POS, no hubs — just their numbers, scoped to them server-side.
 */
export function AllocationPage() {
  const { operator } = useResellerAuth();
  const navigate = useNavigate();
  const signOut = () => { resellerApi.logout(); navigate('/allocation/login', { replace: true }); };
  const { data, isLoading, isError } = useQuery({
    queryKey: ['reseller', 'allocation'],
    queryFn: () => resellerApi.getMyAllocation(),
    refetchInterval: 30_000,
  });

  const blocks = data?.blocks ?? [];

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="flex items-center justify-between border-b bg-background px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold">My ticket allocation</h1>
          {operator?.fullName && (
            <p className="text-xs text-muted-foreground">{operator.fullName}</p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={signOut}>Sign out</Button>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 p-4">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {isError && <p className="text-sm text-red-600">Couldn't load your allocation. Please try again.</p>}
        {!isLoading && !isError && blocks.length === 0 && (
          <p className="text-sm text-muted-foreground">You have no ticket blocks yet.</p>
        )}

        {blocks.map((b) => {
          const pct = b.quantity > 0 ? Math.round((b.sold / b.quantity) * 100) : 0;
          return (
            <div key={`${b.eventId}-${b.tierName}`} className="rounded-xl border bg-background p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold break-words">{b.tierName}</p>
                  <p className="text-sm text-muted-foreground break-words">{b.eventName}</p>
                </div>
                <p className="shrink-0 text-lg font-bold text-primary">{money(b.price, b.currency ?? 'SZL')}</p>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-2xl font-bold">{b.sold}</p>
                  <p className="text-xs text-muted-foreground">Sold</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{b.remaining}</p>
                  <p className="text-xs text-muted-foreground">Remaining</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary">{money(b.collected, b.currency ?? 'SZL')}</p>
                  <p className="text-xs text-muted-foreground">Collected</p>
                </div>
              </div>

              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1 text-right text-xs text-muted-foreground">{b.sold} / {b.quantity} sold</p>
            </div>
          );
        })}
      </main>
    </div>
  );
}
