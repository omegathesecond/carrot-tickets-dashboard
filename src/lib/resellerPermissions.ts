import type { ResellerOperator } from '@/lib/resellerApi';

/**
 * Carrot Tickets reseller permission strings — must match the `reseller:*`
 * namespace the API issues in the auth token / login response
 * (api/src/interfaces/resellerPermission.interface.ts). The backend's
 * RESELLER_ROLE_PERMISSIONS is the single source of truth; the frontend only
 * checks membership in the `permissions` array the login response carries.
 */
export const ResellerPermission = {
  SELL_TICKETS: 'reseller:sell_tickets',
  VIEW_OWN_SALES: 'reseller:view_own_sales',
  VIEW_EVENTS: 'reseller:view_events',
  MANAGE_HUB: 'reseller:manage_hub',
  MANAGE_OPERATORS: 'reseller:manage_operators',
  VIEW_HUB_SALES: 'reseller:view_hub_sales',
  VIEW_REPORTS: 'reseller:view_reports',
  REQUEST_PAYOUT: 'reseller:request_payout',
} as const;

export type ResellerPermissionValue =
  (typeof ResellerPermission)[keyof typeof ResellerPermission];

/**
 * Whether the operator holds a permission.
 *
 * Unlike the back-office `hasPermission`, this does NOT default-allow on an
 * empty array — reseller tokens always carry a permissions array, so an
 * absent/empty list means "deny", never "full access".
 */
export function hasResellerPermission(
  operator: ResellerOperator | null | undefined,
  permission: ResellerPermissionValue,
): boolean {
  if (!operator || !operator.permissions) return false;
  return operator.permissions.includes(permission);
}
