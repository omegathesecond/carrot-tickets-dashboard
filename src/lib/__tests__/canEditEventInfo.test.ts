import { describe, it, expect } from 'vitest';
import { canEditEventInfo } from '@/lib/permissions';
import type { AuthUser, Event } from '@/types';

/**
 * canEditEventInfo drives the "Edit" affordance on the Event Information card.
 * Rule: core details are owner-editable ONLY before the event is published.
 *   - cancelled/completed → nobody edits (matches the API guard)
 *   - super-admins → any still-editable event
 *   - organizers → only while draft / pending_approval (before it goes live)
 *   - users without event-management capability → never
 */
const organizer = (): AuthUser =>
  ({ _id: 'v1', businessName: 'Org', role: 'tickets_owner', isActive: true, createdAt: '' } as AuthUser);

const admin = (): AuthUser => ({ ...organizer(), isSuperAdmin: true } as AuthUser);

const salesOnly = (): AuthUser =>
  ({ ...organizer(), permissions: ['tickets:view_events', 'tickets:sell_tickets'] } as AuthUser);

const ev = (status: Event['status']): Event => ({ status } as Event);

describe('canEditEventInfo', () => {
  it('lets an organizer edit a DRAFT event', () => {
    expect(canEditEventInfo(ev('draft'), organizer())).toBe(true);
  });

  it('lets an organizer edit a PENDING_APPROVAL event', () => {
    expect(canEditEventInfo(ev('pending_approval'), organizer())).toBe(true);
  });

  it('blocks an organizer once the event is PUBLISHED', () => {
    expect(canEditEventInfo(ev('published'), organizer())).toBe(false);
  });

  it('blocks everyone on a CANCELLED event, including admins', () => {
    expect(canEditEventInfo(ev('cancelled'), organizer())).toBe(false);
    expect(canEditEventInfo(ev('cancelled'), admin())).toBe(false);
  });

  it('blocks everyone on a COMPLETED event, including admins', () => {
    expect(canEditEventInfo(ev('completed'), organizer())).toBe(false);
    expect(canEditEventInfo(ev('completed'), admin())).toBe(false);
  });

  it('lets an admin edit a PUBLISHED event', () => {
    expect(canEditEventInfo(ev('published'), admin())).toBe(true);
  });

  it('blocks a user without event-management capability, even on a draft', () => {
    expect(canEditEventInfo(ev('draft'), salesOnly())).toBe(false);
  });

  it('returns false for a null user or null event', () => {
    expect(canEditEventInfo(ev('draft'), null)).toBe(false);
    expect(canEditEventInfo(null, organizer())).toBe(false);
  });
});
