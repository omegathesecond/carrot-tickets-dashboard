import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient, PRODUCT_CATEGORIES } from '@/lib/api';
import { formatMoney } from '@/lib/currency';
import { matchesSearch } from '@/lib/search';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function StallMenuPanel({ eventId, merchantId, stallName }: { eventId: string; merchantId: string; stallName: string }) {
  const [search, setSearch] = useState('');
  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['stall-menu', eventId, merchantId],
    queryFn: async () => {
      const menu = await apiClient.merchants.menu(merchantId);
      if (menu.merchantId !== merchantId || menu.event.id !== eventId) throw new Error('This stall does not belong to this event.');
      return menu;
    },
    retry: false,
  });
  const label = (name: string) => {
    const prefix = `${stallName} - `;
    return name.toLowerCase().startsWith(prefix.toLowerCase()) ? name.slice(prefix.length) : name;
  };
  const products = data?.products.filter(p => matchesSearch(search, p.name, p.category)) ?? [];

  return <section aria-label="Stall menu" className="space-y-4">
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold">Menu</h2>
      {data && !isError && <Badge variant="secondary">{data.products.length} item{data.products.length === 1 ? '' : 's'}</Badge>}
    </div>
    {isPending ? <p className="text-sm text-muted-foreground">Loading menu…</p> : isError ? (
      <div role="alert" className="space-y-2">
        <p className="text-sm text-red-600">Could not load this stall’s menu{error instanceof Error ? ` — ${error.message}` : ''}</p>
        <Button size="sm" variant="outline" disabled={isFetching} onClick={() => refetch()}>Retry menu</Button>
      </div>
    ) : data && data.products.length === 0 ? <p className="text-sm text-muted-foreground">No menu items have been assigned to this stall yet.</p> : data ? <>
      <Input type="search" aria-label="Search stall menu" placeholder="Search this menu…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />
      {products.length === 0 ? <p className="text-sm text-muted-foreground">No menu items match your search.</p> : <ul className="grid gap-3 sm:grid-cols-2">
        {products.map(p => <li key={p.productId} className="rounded-lg border p-4 flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="font-medium break-words">{label(p.name)}</p>
            <p className="text-xs text-muted-foreground">{PRODUCT_CATEGORIES.find(c => c.value === p.category)?.label ?? p.category}</p>
            {p.status === 'untracked' && <span className="text-xs text-muted-foreground">Not counted</span>}
            {p.status === 'sold_out' && <Badge variant="secondary">Sold out</Badge>}
          </div>
          <div className="shrink-0 text-right">
            <p className="font-semibold">{formatMoney(p.price / 100, data.event.currency, { decimals: 2 })}</p>
            {p.bundlePrice && <p className="text-xs text-muted-foreground">{p.bundlePrice.quantity} for {formatMoney(p.bundlePrice.price / 100, data.event.currency, { decimals: 2 })}</p>}
          </div>
        </li>)}
      </ul>}
    </> : null}
  </section>;
}
