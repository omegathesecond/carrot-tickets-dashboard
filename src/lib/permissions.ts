import type { AuthUser } from '@/types';

/**
 * Keshless Tickets permission strings — must match the `tickets:*` namespace
 * the API issues in the auth token / `getMe` response
 * (api/src/interfaces/ticketsPermission.interface.ts).
 */
export const TicketsPermission = {
  CREATE_EVENT: 'tickets:create_event',
  EDIT_EVENT: 'tickets:edit_event',
  VIEW_EVENTS: 'tickets:view_events',
  SELL_TICKETS: 'tickets:sell_tickets',
  VIEW_SALES: 'tickets:view_sales',
  SCAN_TICKETS: 'tickets:scan_tickets',
  VIEW_SCANS: 'tickets:view_scans',
  VIEW_STATS: 'tickets:view_stats',
} as const;

export type TicketsPermissionValue =
  (typeof TicketsPermission)[keyof typeof TicketsPermission];

/**
 * Whether the user holds a permission.
 *
 * Defaults to `true` when the account exposes no `permissions` array — full
 * vendor (OWNER) accounts and any legacy token without the field keep their
 * existing access, so this only ever *narrows* tabs for restricted accounts
 * (e.g. a sales-only reseller like PicknPay).
 */
export function hasPermission(
  user: AuthUser | null | undefined,
  permission: TicketsPermissionValue
): boolean {
  if (!user) return false;
  if (!user.permissions || user.permissions.length === 0) return true;
  return user.permissions.includes(permission);
}

/** Event-management capability (create/edit) — drives the Events tab. */
export function canManageEvents(user: AuthUser | null | undefined): boolean {
  return (
    hasPermission(user, TicketsPermission.CREATE_EVENT) ||
    hasPermission(user, TicketsPermission.EDIT_EVENT)
  );
}
