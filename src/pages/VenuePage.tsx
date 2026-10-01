import type { ReactNode } from 'react';
import { Store } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { canManageVenue } from '@/lib/permissions';
import { useMyVenue } from '@/hooks/useMyVenue';
import { currencyLabel } from '@/lib/currency';

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function Notice({ title, description }: { title: string; description: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  );
}

/**
 * The vendor's venue (venue trading spec, Phase 1). Shows which state venue
 * trading is in; later phases add stalls, stock, staff and trading days here.
 * A failed lookup is shown as a failure with Try again — never as "not on yet".
 */
export function VenuePage() {
  const { user } = useAuth();
  const { data, isLoading, isError, error, refetch, isFetching } = useMyVenue();

  let body: ReactNode;
  if (!canManageVenue(user)) {
    body = <Notice title="You don't have access to the venue" description="Ask the account owner to give you venue access." />;
  } else if (isLoading) {
    body = <p className="text-slate-500">Loading venue…</p>;
  } else if (isError) {
    body = (
      <Card>
        <CardHeader>
          <CardTitle>Couldn't load your venue</CardTitle>
          <CardDescription>{error instanceof Error ? error.message : 'Something went wrong.'}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => refetch()} disabled={isFetching}>Try again</Button>
        </CardContent>
      </Card>
    );
  } else if (!data?.venue) {
    body = data?.eligible
      ? <Notice title="Venue trading isn't on yet" description="Carrot switches it on after a quick check." />
      : <Notice title="This account doesn't use venue trading" description="Venue trading is for bars, restaurants and lounges." />;
  } else if (data.venue.status === 'suspended') {
    body = <Notice title="Venue trading is suspended" description="Contact Carrot." />;
  } else {
    const v = data.venue;
    body = (
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div className="flex items-center gap-3">
            <Store className="h-6 w-6 text-orange-600" />
            <CardTitle>{v.name}</CardTitle>
          </div>
          <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">Active</Badge>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
            <div>
              <dt className="text-slate-500">Currency</dt>
              <dd className="font-medium">{currencyLabel(v.currency)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Switched on</dt>
              <dd className="font-medium">{formatDate(v.activatedAt)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Venue</h1>
      {body}
    </div>
  );
}
