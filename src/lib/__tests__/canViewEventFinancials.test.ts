import { describe, it, expect } from 'vitest';
import { canViewEventFinancials } from '@/lib/permissions';
import type { AuthUser } from '@/types';

/**
 * canViewEventFinancials drives the Financials tab on the event page. It has to
 * agree with the server guard on GET /tickets/stats/events/:id/financials,
 * which sits behind VIEW_REVENUE — the payload carries proceeds and custody, so
 * a team member scoped to scanning or stats must not see it.
 */
const owner = (): AuthUser =>
  ({ _id: 'v1', businessName: 'Org', role: 'tickets_owner', isActive: true, createdAt: '' } as AuthUser);

const withPerms = (permissions: string[]): AuthUser => ({ ...owner(), permissions } as AuthUser);

describe('canViewEventFinancials', () => {
  it('shows the tab to an owner account that carries no permissions array', () => {
    // Owner tokens predate the permissions array; they must keep full access or
    // an organizer loses sight of their own takings.
    expect(canViewEventFinancials(owner())).toBe(true);
  });

  it('shows the tab to a team member granted view_revenue', () => {
    expect(canViewEventFinancials(withPerms(['tickets:view_events', 'tickets:view_revenue']))).toBe(true);
  });

  it('hides the tab from a stats-only team member', () => {
    // view_stats is NOT enough — that's counts, this is money.
    expect(canViewEventFinancials(withPerms(['tickets:view_events', 'tickets:view_stats']))).toBe(false);
  });

  it('hides the tab from a scanner-only operator', () => {
    expect(canViewEventFinancials(withPerms(['tickets:scan_tickets']))).toBe(false);
  });

  it('hides the tab when there is no user', () => {
    expect(canViewEventFinancials(null)).toBe(false);
  });
});
