import { Navigate } from 'react-router-dom';
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div>Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/reseller/login" replace />;
  }

  if (requires && !hasResellerPermission(operator, requires)) {
    return <Navigate to="/reseller" replace />;
  }

  return <>{children}</>;
}
