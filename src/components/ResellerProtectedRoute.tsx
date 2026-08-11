import { Navigate, useLocation } from 'react-router-dom';
import { useResellerAuth } from '@/contexts/ResellerAuthContext';
import { hasResellerPermission, type ResellerPermissionValue } from '@/lib/resellerPermissions';

export function ResellerProtectedRoute({
  children,
  requires,
  loginPath = '/reseller/login',
}: {
  children: React.ReactNode;
  requires?: ResellerPermissionValue;
  /** Where to send unauthenticated users (allocation partners → /allocation/login). */
  loginPath?: string;
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
    const sep = loginPath.includes('?') ? '&' : '?';
    return <Navigate to={`${loginPath}${sep}redirect=${redirect}`} replace />;
  }

  if (requires && !hasResellerPermission(operator, requires)) {
    return <Navigate to="/reseller" replace />;
  }

  return <>{children}</>;
}
