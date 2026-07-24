// Shared "who sells the tickets?" logic for the event create/edit forms
// (EventsPage's create dialog + EventDetailsPage's Ticketing card).
//
// `carrot`   = Carrot processes the sale (existing checkout + ticket tiers).
// `external` = the organizer sells tickets on their own site; the API
//              refuses to process a sale for these events (fail-loud), so
//              the dashboard's only job is to collect + validate the link.
export type Ticketing = 'carrot' | 'external';

export const DEFAULT_TICKETING: Ticketing = 'carrot';

/**
 * Validates the "Ticket link" field required when ticketing === 'external'.
 * Returns an error message to show under the field, or null if it's a valid
 * absolute https:// URL. Rejects http:, javascript:, data:, blank, and
 * malformed values — mirrors the API's own validation (defense-in-depth).
 */
export function validateExternalTicketUrl(url: string | undefined | null): string | null {
  const trimmed = (url ?? '').trim();
  if (!trimmed) return 'Ticket link is required when you sell tickets yourself.';

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return 'Enter a valid URL (e.g. https://example.com/tickets).';
  }

  if (parsed.protocol !== 'https:') {
    return 'Ticket link must start with https://.';
  }

  return null;
}

/**
 * Validates the whole ticketing selection for the event form. 'carrot' has
 * nothing extra to check here (ticket tier requirements are enforced by the
 * existing tier editor); 'external' requires a valid https ticket link.
 */
export function validateTicketingSelection(
  ticketing: Ticketing,
  externalTicketUrl: string | undefined | null
): string | null {
  if (ticketing === 'external') return validateExternalTicketUrl(externalTicketUrl);
  return null;
}

/**
 * Builds the ticketing-related fields to merge into the create/update event
 * payload. Drops `externalTicketUrl` for carrot events so a stale link the
 * organizer typed before switching back doesn't get sent to the API.
 */
export function buildTicketingPayload(
  ticketing: Ticketing,
  externalTicketUrl: string | undefined | null
): { ticketing: Ticketing; externalTicketUrl?: string } {
  if (ticketing === 'external') {
    return { ticketing, externalTicketUrl: (externalTicketUrl ?? '').trim() };
  }
  return { ticketing };
}
