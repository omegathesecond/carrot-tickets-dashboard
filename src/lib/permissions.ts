import type { AuthUser, Event } from '@/types';

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
  MANAGE_ACCESS: 'tickets:manage_access',
  VIEW_USERS: 'tickets:view_users',
  PRINT_WRISTBANDS: 'tickets:print_wristbands',
  MODERATE_SOCIAL: 'tickets:moderate_social',
  VIEW_TRANSPORT: 'tickets:view_transport',
  MANAGE_TRANSPORT: 'tickets:manage_transport',
  MANAGE_STOCK: 'tickets:manage_stock',
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

/**
 * Whether the "Event Information" (name, venue, date/time, description, …) may
 * be edited — drives the Edit affordance on the event details page. Core
 * details are owner-editable ONLY before the event goes live: a draft/
 * pending_approval event has no sold tickets, so the organizer may freely fix
 * it; once published, changing it is a bait-and-switch on ticket holders and
 * only an admin may correct it. Cancelled/completed are locked for everyone.
 * Mirrors the server guard in EventService.updateEvent.
 */
export function canEditEventInfo(
  event: Pick<Event, 'status'> | null | undefined,
  user: AuthUser | null | undefined
): boolean {
  if (!event || !user) return false;
  if (!canManageEvents(user)) return false;
  if (event.status === 'cancelled' || event.status === 'completed') return false;
  if (user.isSuperAdmin) return true;
  return event.status === 'draft' || event.status === 'pending_approval';
}

/**
 * Gate-operator management — super-admins always have this; vendor users only
 * if the API has issued the `tickets:manage_access` permission in their token.
 */
export function canManageAccess(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  if (user.isSuperAdmin) return true;
  return hasPermission(user, TicketsPermission.MANAGE_ACCESS);
}

/**
 * Platform Users tab (registered buyers + signup analytics) — Carrot staff only.
 * Super-admins always; other team members only with the explicit
 * `tickets:view_users` permission. Regular organizers never qualify.
 *
 * NOTE: unlike hasPermission's "empty array = full access" default, this must
 * fail closed for owner accounts that carry no permissions array — so we check
 * membership explicitly rather than via hasPermission.
 */
export function canViewUsers(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  if (user.isSuperAdmin) return true;
  return (user.permissions ?? []).includes(TicketsPermission.VIEW_USERS);
}

/**
 * Wristband designer/printing — Carrot staff only (office printer + Tyvek
 * stock). Super-admins always; team members only with the explicit
 * `tickets:print_wristbands` permission. Fail-closed like canViewUsers: an
 * owner account with no permissions array must NOT qualify.
 */
export function canPrintWristbands(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  if (user.isSuperAdmin) return true;
  return (user.permissions ?? []).includes(TicketsPermission.PRINT_WRISTBANDS);
}

/**
 * Platform social moderation queue (buyer-filed reports against messages/
 * buyers) — Carrot staff only. Super-admins always; other team members only
 * with the explicit `tickets:moderate_social` permission. Fail-closed like
 * canViewUsers/canPrintWristbands: an owner account with no permissions
 * array must NOT qualify.
 */
export function canModerateSocial(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  if (user.isSuperAdmin) return true;
  return (user.permissions ?? []).includes(TicketsPermission.MODERATE_SOCIAL);
}

/** Transport (bus) management capability — drives the Transport tab. */
export function canManageTransport(user: AuthUser | null | undefined): boolean {
  return (
    hasPermission(user, TicketsPermission.MANAGE_TRANSPORT) ||
    hasPermission(user, TicketsPermission.VIEW_TRANSPORT)
  );
}

/**
 * Cashless stock/catalogue management — drives the Catalogue page + sidebar
 * entry. Super-admins always; vendor owners (no permissions array) keep access
 * via hasPermission's default; restricted team members only with the explicit
 * `tickets:manage_stock`. The API still enforces per request.
 */
export function canManageStock(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  if (user.isSuperAdmin) return true;
  return hasPermission(user, TicketsPermission.MANAGE_STOCK);
}
