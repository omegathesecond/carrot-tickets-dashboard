import { describe, it, expect, vi } from 'vitest';

// socialFeed.ts imports the apiClient (for mintSocialFeedUrl), whose real
// constructor reads `localStorage` at module load — absent in the node test
// env. Stub the module so importing the pure predicate doesn't drag it in.
vi.mock('@/lib/api', () => ({
  apiClient: { auth: { socialHandoff: vi.fn() } },
}));

import { shouldLandOnSocialFeed } from '@/lib/socialFeed';
import { TicketsPermission } from '@/lib/permissions';
import type { AuthUser } from '@/types';

function makeUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    _id: 'u1',
    businessName: 'Acme Events',
    role: 'tickets_owner',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('shouldLandOnSocialFeed', () => {
  it('sends a full event-organizer owner (no permissions array) to the feed', () => {
    // An OWNER account carries no `permissions` array, which hasPermission
    // reads as full access — the canonical event organizer.
    expect(shouldLandOnSocialFeed(makeUser())).toBe(true);
  });

  it('sends a restricted account with create_event to the feed', () => {
    expect(
      shouldLandOnSocialFeed(makeUser({ permissions: [TicketsPermission.CREATE_EVENT] })),
    ).toBe(true);
  });

  it('sends a restricted account with edit_event to the feed', () => {
    expect(
      shouldLandOnSocialFeed(makeUser({ permissions: [TicketsPermission.EDIT_EVENT] })),
    ).toBe(true);
  });

  it('keeps a Carrot super-admin on the dashboard even with full access', () => {
    // Super-admins are platform staff, not a brand — they must not be bounced
    // to the consumer social feed, even though canManageEvents is true for them.
    expect(shouldLandOnSocialFeed(makeUser({ isSuperAdmin: true }))).toBe(false);
  });

  it('keeps a sales-only reseller on the dashboard', () => {
    // A PicknPay-style reseller can only sell tickets — no event management,
    // so no brand social feed to land on.
    expect(
      shouldLandOnSocialFeed(makeUser({ permissions: [TicketsPermission.SELL_TICKETS] })),
    ).toBe(false);
  });

  it('keeps a transport-only operator (scan/sell only) on the dashboard', () => {
    expect(
      shouldLandOnSocialFeed(
        makeUser({
          operatorType: 'transport',
          permissions: [TicketsPermission.VIEW_TRANSPORT, TicketsPermission.SELL_TICKETS],
        }),
      ),
    ).toBe(false);
  });

  it('returns false for a missing user', () => {
    expect(shouldLandOnSocialFeed(null)).toBe(false);
    expect(shouldLandOnSocialFeed(undefined)).toBe(false);
  });
});
