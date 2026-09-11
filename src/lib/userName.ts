import type { AuthUser } from '@/types';

/**
 * How a signed-in dashboard user is named in the UI and on printed receipts.
 * Sub-users (box-office staff) carry first/last names; vendor accounts only
 * carry a business name.
 */
export function userDisplayName(user: AuthUser | null | undefined): string {
  if (user?.firstName && user?.lastName) {
    return `${user.firstName} ${user.lastName}`;
  }
  return user?.businessName || 'User';
}
