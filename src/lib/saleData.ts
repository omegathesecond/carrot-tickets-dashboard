import type { Currency } from '@/lib/currency';

// Shared shape for a completed ticket sale — built by the reseller POS and the
// organizer's Sell Tickets page, then passed into the success dialog, the
// printed receipt, and the SMS call. `paymentMethod` is the already-humanized
// label (e.g. "MTN MoMo"), not the raw method id.
export interface SaleData {
  saleId: string;
  eventName: string;
  eventDate?: string;
  venue?: string;
  ticketTypeName: string;
  // Price per ticket. Only meaningful when every ticket in the sale is the
  // same tier — a mixed basket (2 x GA + 1 x VIP) has no single unit price, so
  // callers leave it unset and the receipt omits the "Qty x Price" row rather
  // than printing a made-up figure on a customer's receipt.
  unitPrice?: number;
  customerName: string;
  customerPhone: string;
  quantity: number;
  totalAmount: number;
  paymentMethod: string;
  operatorName: string;
  ticketIds: string[];
  // The event's display currency — absent on legacy callers, so consumers
  // fall back to 'SZL'.
  currency?: Currency;
  // Who each MINTED ticket is actually for, keyed by the same ids as
  // `ticketIds`. Read straight off the sell response, so the success dialog
  // can seed its per-ticket rows with the recipients the till already
  // captured instead of making the operator retype three names from memory
  // in the right order. Optional and additive — the reseller POS does not
  // supply it and must keep working untouched.
  ticketRecipients?: Record<string, SaleTicketRecipient>;
}

/** One minted ticket's recipient, as the API stored it. */
export interface SaleTicketRecipient {
  name?: string;
  phone?: string;
  email?: string;
}
