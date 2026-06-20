import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export function AdminRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user?.isSuperAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}
