import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { canPrintWristbands } from '@/lib/permissions';

/**
 * Gates the Wristbands tab: super-admins or team members holding
 * `tickets:print_wristbands`. Defence in depth — the sidebar already hides
 * the link, this stops direct navigation.
 */
export function WristbandsRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!canPrintWristbands(user)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
