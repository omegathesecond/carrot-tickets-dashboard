/**
 * Who a stall/stock screen is for: one event, or the signed-in vendor's own
 * venue (venue trading). A venue needs no id — the API resolves it from the
 * session, so another venue can never be addressed.
 */
export type StockScope = { kind: 'event'; eventId: string } | { kind: 'venue' };

/** API prefix for scope-owned stock routes: `/tickets/events/:id` or `/tickets/venue`. */
export function stockBase(scope: StockScope): string {
  return scope.kind === 'event' ? `/tickets/events/${scope.eventId}` : '/tickets/venue';
}

/** API prefix for the scope's stalls: `/tickets/merchants` (the event goes in ?eventId= or the body) or `/tickets/venue/stalls`. */
export function stallsBase(scope: StockScope): string {
  return scope.kind === 'event' ? '/tickets/merchants' : '/tickets/venue/stalls';
}

/** API prefix for a till operator addressed by its own id: `/tickets/merchant-operators` or `/tickets/venue/operators`. */
export function operatorsBase(scope: StockScope): string {
  return scope.kind === 'event' ? '/tickets/merchant-operators' : '/tickets/venue/operators';
}

/** A stable react-query key segment for the scope. */
export function scopeKey(scope: StockScope): string {
  return scope.kind === 'event' ? `event:${scope.eventId}` : 'venue';
}

/** Where a stall's detail page lives for this scope. */
export function stallPath(scope: StockScope, merchantId: string): string {
  return scope.kind === 'event' ? `/events/${scope.eventId}/stalls/${merchantId}` : `/venue/stalls/${merchantId}`;
}
