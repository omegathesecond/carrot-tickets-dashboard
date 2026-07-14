import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { canManageTransport } from '@/lib/permissions';

/**
 * Gates the Transport tab: super-admins or team members holding
 * `tickets:manage_transport`/`tickets:view_transport`. Defence in depth — the
 * sidebar already hides the link, this stops direct navigation.
 */
export function TransportRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!canManageTransport(user)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
