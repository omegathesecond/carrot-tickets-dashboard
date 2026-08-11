import { Navigate, useLocation } from 'react-router-dom';
import { useResellerAuth } from '@/contexts/ResellerAuthContext';
import { hasResellerPermission, type ResellerPermissionValue } from '@/lib/resellerPermissions';

export function ResellerProtectedRoute({
  children,
  requires,
}: {
  children: React.ReactNode;
  requires?: ResellerPermissionValue;
}) {
  const { isAuthenticated, isLoading, operator } = useResellerAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div>Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Preserve where the partner was headed (e.g. /allocation) so login returns them there.
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/reseller/login?redirect=${redirect}`} replace />;
  }

  if (requires && !hasResellerPermission(operator, requires)) {
    return <Navigate to="/reseller" replace />;
  }

  return <>{children}</>;
}
