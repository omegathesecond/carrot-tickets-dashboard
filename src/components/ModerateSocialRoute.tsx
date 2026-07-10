import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { canModerateSocial } from '@/lib/permissions';

/**
 * Gates the platform Reports (social moderation queue) tab: super-admins or
 * team members holding `tickets:moderate_social`. Regular organizers are
 * bounced home. Defence in depth — the sidebar already hides the link, this
 * stops direct navigation.
 */
export function ModerateSocialRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!canModerateSocial(user)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
