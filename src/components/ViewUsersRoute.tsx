import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { canViewUsers } from '@/lib/permissions';

/**
 * Gates the platform Users tab: super-admins or team members holding
 * `tickets:view_users`. Regular organizers are bounced home. Defence in depth —
 * the sidebar already hides the link, this stops direct navigation.
 */
export function ViewUsersRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!canViewUsers(user)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
