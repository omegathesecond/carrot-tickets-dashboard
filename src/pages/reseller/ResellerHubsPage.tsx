import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useResellerAuth } from '@/contexts/ResellerAuthContext';
import { resellerHubsApi } from '@/lib/resellerApi';

const HUB_VIEW_ROLES = ['reseller_admin', 'reseller_hub_manager'];

/**
 * The "Hubs" nav opens a hub directly (no list-then-click). We just resolve the
 * first hub in scope and redirect to its detail; switching between hubs happens
 * via the dropdown on the detail page.
 */
export function ResellerHubsPage() {
  const { operator } = useResellerAuth();
  const { data: hubs = [], isLoading } = useQuery({
    queryKey: ['portal-hubs'],
    queryFn: () => resellerHubsApi.list(),
  });

  if (operator && !HUB_VIEW_ROLES.includes(operator.role)) {
    return <Navigate to="/reseller" replace />;
  }
  if (isLoading) {
    return <div className="p-6 text-sm text-slate-500">Loading…</div>;
  }
  if (hubs.length === 0) {
    return <div className="p-6 text-sm text-slate-500">No hubs.</div>;
  }
  return <Navigate to={`/reseller/hubs/${hubs[0]._id}`} replace />;
}
