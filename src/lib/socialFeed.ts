import type { AuthUser } from '@/types';
import { apiClient } from '@/lib/api';
import { canManageEvents } from '@/lib/permissions';
import { LANDING_URL } from '@/lib/constants';

// The organizer's brand social feed lives on the consumer site (same login).
// This is the single door from the dashboard so organizers don't need a 2nd URL.
//
// Built from the env-aware LANDING_URL so the SSO handoff is minted AND exchanged
// on the SAME environment. A DEV dashboard (VITE_LANDING_URL=dev.carrottickets.com)
// must send the handoff to the DEV landing → DEV api; hardcoding the prod host made
// dev mint on dev-api (dev JWT secret) but exchange on prod api (prod JWT secret),
// so verification failed and surfaced as "this sign-in link has expired". Prod has
// no VITE_LANDING_URL, so it falls back to www.carrottickets.com (unchanged).
export const SOCIAL_LOGIN_URL = `${LANDING_URL}/brand/login`;
export const SOCIAL_SSO_URL = `${LANDING_URL}/brand/sso`;

/**
 * Whether this account should LAND on the brand social feed after login.
 *
 * Exactly the accounts that see the "Brand social feed" button in the sidebar:
 * event organizers who can manage events. Deliberately excludes
 *  - Carrot super-admins (platform staff, not a brand — they run the dashboard),
 *  - transport-only / sales-only resellers (no event management, no feed).
 * Everyone excluded keeps their normal `operatorHomePath` landing.
 */
export function shouldLandOnSocialFeed(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  if (user.isSuperAdmin) return false;
  return canManageEvents(user);
}

/**
 * Mint a one-time SSO handoff and return the social-feed URL the organizer can
 * open to land already signed in (no second login). Returns `null` if the
 * handoff can't be minted, so callers can fall back (a new tab to the social
 * login page, or — for the post-login redirect — the dashboard home).
 */
export async function mintSocialFeedUrl(): Promise<string | null> {
  try {
    const { handoff } = await apiClient.auth.socialHandoff();
    return `${SOCIAL_SSO_URL}#h=${encodeURIComponent(handoff)}`;
  } catch {
    return null;
  }
}
