import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { canOpenVenue } from '@/lib/permissions';

/**
 * The signed-in vendor's venue — ONE cached answer shared by the Sidebar (is
 * there a Venue section?) and VenuePage (which state to show). Never fetched
 * for a super-admin (the platform account is never a venue) or for a user who
 * can open neither of its tabs — no MANAGE_VENUE (Stalls) and no MANAGE_STOCK
 * (Catalogue & stock) — so the section is not theirs.
 */
export function useMyVenue() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-venue'],
    queryFn: () => apiClient.venue.mine(),
    enabled: !!user && !user.isSuperAdmin && canOpenVenue(user),
    staleTime: 60_000,
  });
}
