import type { TicketSale } from '@/types';

/**
 * Ticket type name for a sale. A sale is always for a single ticket type, so
 * we read it from the first populated ticket (falling back to a populated
 * `ticketType` object if the API ever provides one).
 */
export function getSaleTicketType(sale: TicketSale): string {
  const fromTicket = sale.ticketIds?.[0]?.ticketType;
  if (fromTicket) return fromTicket;
  if (sale.ticketType?.name) return sale.ticketType.name;
  return 'N/A';
}

/** The scannable ticket code(s) for a sale, e.g. "TKT-123" or "TKT-123 +2". */
export function getSaleTicketCodes(sale: TicketSale): string {
  const codes = (sale.ticketIds || [])
    .map((t) => t.ticketId)
    .filter(Boolean) as string[];
  if (codes.length === 0) return '—';
  if (codes.length === 1) return codes[0];
  return `${codes[0]} +${codes.length - 1}`;
}
