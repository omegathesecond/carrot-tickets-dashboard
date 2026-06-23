import { Navigate } from 'react-router-dom';
import { useResellerAuth } from '@/contexts/ResellerAuthContext';

export function ResellerProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useResellerAuth();

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

  return <>{children}</>;
}
