import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';
import { AlertCircle, Clock } from 'lucide-react';

/**
 * Approval in Keshless Tickets is per-EVENT, not per-organizer-account. This
 * banner tells an organizer that one or more of their events are sitting in the
 * approval queue — and, crucially, disappears on its own once every event has
 * been approved (or none are pending). It is NOT keyed off the account's
 * verification status, so an organizer with all events live sees nothing.
 *
 * A suspended/rejected account is a separate, genuine account-level block and
 * still gets its own red notice.
 */
export function VerificationBanner() {
  const { user } = useAuth();

  // Admins approve events; they don't need the organizer-facing banner.
  const isAdmin = !!user?.isSuperAdmin;

  const accountBlocked =
    user?.verificationStatus === 'rejected' || user?.verificationStatus === 'suspended';

  const { data: eventsData } = useQuery({
    queryKey: ['events'],
    queryFn: () => apiClient.events.getEvents({ limit: 100 }),
    enabled: !!user && !isAdmin && !accountBlocked,
  });

  if (!user || isAdmin) return null;

  // Genuine account-level sanction — keep warning the organizer.
  if (accountBlocked) {
    return (
      <div className="flex items-start gap-3 px-4 py-3 text-sm border-b bg-red-50 border-red-200 text-red-800">
        <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
        <p>
          <span className="font-semibold">Account {user.verificationStatus}.</span>{' '}
          Publishing is disabled. Please contact Keshless support to resolve this.
        </p>
      </div>
    );
  }

  const pendingCount =
    eventsData?.data?.filter((e) => e.status === 'pending_approval').length ?? 0;

  // No events awaiting approval → nothing to show.
  if (pendingCount === 0) return null;

  return (
    <div className="flex items-start gap-3 px-4 py-3 text-sm border-b bg-amber-50 border-amber-200 text-amber-900">
      <Clock className="h-5 w-5 shrink-0 mt-0.5" />
      <p>
        <span className="font-semibold">
          {pendingCount === 1
            ? 'You have an event awaiting approval.'
            : `You have ${pendingCount} events awaiting approval.`}
        </span>{' '}
        Keshless is reviewing {pendingCount === 1 ? 'it' : 'them'} — once approved,{' '}
        {pendingCount === 1 ? 'it goes' : 'they go'} live and tickets can be sold.
      </p>
    </div>
  );
}
