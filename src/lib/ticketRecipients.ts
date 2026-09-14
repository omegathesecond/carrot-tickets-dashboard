/**
 * How many per-ticket recipient rows either surface will render.
 *
 * ONE number, shared by the till's "Assign tickets to individual people"
 * panel and the success dialog's per-ticket rows. Two separate limits is how
 * a 50-ticket sale ended up with recipients the till happily captured and the
 * dialog then rendered as plain chips — no Send button, no Download button,
 * nothing to act on.
 *
 * 100 is the API's own ceiling: POST /tickets/sales/sell caps `recipients` at
 * 100 entries per line, and quantity per line at 100.
 */
export const MAX_RECIPIENT_ROWS = 100;

/**
 * Above this many rows the dialog stops laying them out full-height and
 * scrolls them instead — every row is still rendered and still sendable.
 */
export const SCROLL_RECIPIENT_ROWS_ABOVE = 20;
