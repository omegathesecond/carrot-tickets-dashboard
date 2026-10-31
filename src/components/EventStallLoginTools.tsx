import { apiClient } from '@/lib/api';
import { StallLoginExports, stallLoginTargets } from '@/components/StallLoginExports';
import { StallLoginPicker } from '@/components/StallLoginPicker';

/** Available on the main Stalls view, independent of its financial summary. */
export function EventStallLoginTools({ eventId, eventName }: { eventId: string; eventName: string }) {
  const loadAllLogins = async () => {
    const active = (await apiClient.merchants.list(eventId)).filter(stall => stall.status === 'active');
    const results = await Promise.allSettled(active.map(async stall => stallLoginTargets(stall.name, (await apiClient.merchantOperators.list(stall._id)).operators)));
    return results.flatMap((result, i) => {
      if (result.status === 'rejected') throw new Error(`Could not load staff at ${active[i]!.name}: ${result.reason instanceof Error ? result.reason.message : 'Request failed'}`);
      return result.value;
    });
  };
  return <div className="flex flex-wrap gap-2">
    <StallLoginPicker eventId={eventId} eventName={eventName} loadTargets={loadAllLogins} />
    <StallLoginExports name={eventName} loadTargets={loadAllLogins} />
  </div>;
}
