import { apiClient } from '@/lib/api';
import { StallLoginExports, stallLoginTargets } from '@/components/StallLoginExports';
import { StallLoginPicker } from '@/components/StallLoginPicker';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

/** Available on the main Stalls view, independent of its financial summary. */
export function EventStallLoginTools({ eventId, eventName, canExport = false }: { eventId: string; eventName: string; canExport?: boolean }) {
  const queryClient = useQueryClient();
  const createUsers = useMutation({
    mutationFn: () => apiClient.merchantOperators.createMissingForEvent(eventId),
    onSuccess: result => {
      queryClient.invalidateQueries({ queryKey: ['merchantOperators'] });
      queryClient.invalidateQueries({ queryKey: ['stall-login-people', eventId] });
      if (!result.created && !result.existing) {
        toast.info('Add active stalls first, then auto-create their users.');
        return;
      }
      toast.success(`Created ${result.created} user${result.created === 1 ? '' : 's'}. ${result.existing} stall${result.existing === 1 ? '' : 's'} already had matching users.`);
      if (result.inactive) toast.info(`${result.inactive} matching user${result.inactive === 1 ? ' is' : 's are'} deactivated. Reactivate them from the stall if needed.`);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const loadAllLogins = async () => {
    const active = (await apiClient.merchants.list(eventId)).filter(stall => stall.status === 'active');
    const results = await Promise.allSettled(active.map(async stall => stallLoginTargets(stall.name, (await apiClient.merchantOperators.list(stall._id)).operators)));
    return results.flatMap((result, i) => {
      if (result.status === 'rejected') throw new Error(`Could not load staff at ${active[i]!.name}: ${result.reason instanceof Error ? result.reason.message : 'Request failed'}`);
      return result.value;
    });
  };
  return <div className="flex flex-wrap gap-2">
    <Button size="sm" variant="outline" disabled={createUsers.isPending} onClick={() => createUsers.mutate()} title="Create a user named after each active stall that has no matching user">
      {createUsers.isPending ? 'Creating users…' : 'Auto-create users'}
    </Button>
    {canExport && <>
      <StallLoginPicker eventId={eventId} eventName={eventName} loadTargets={loadAllLogins} />
      <StallLoginExports name={eventName} loadTargets={loadAllLogins} />
    </>}
  </div>;
}
