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
}
