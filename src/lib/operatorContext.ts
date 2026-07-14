import type { AuthUser } from '@/types';

export type OperatorContext = 'events' | 'transport' | 'both';

export function getOperatorContext(user: AuthUser | null | undefined): OperatorContext {
  return user?.operatorType ?? 'events';
}

export function operatorLabel(ctx: OperatorContext): string {
  if (ctx === 'transport') return 'Bus Ticket Operator';
  if (ctx === 'both') return 'Events & Bus';
  return 'Event Organizer';
}

/** Where an operator lands after login. Transport operators skip the
 *  event-centric dashboard (empty charts) and go straight to their trips. */
export function operatorHomePath(ctx: OperatorContext): string {
  return ctx === 'transport' ? '/transport/trips' : '/';
}
