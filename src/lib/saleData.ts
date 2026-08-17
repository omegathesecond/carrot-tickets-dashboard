import type { Currency } from '@/lib/currency';

// Shared shape for a completed reseller sale, passed from the POS page into the
// success dialog, the printed receipt, and the SMS call. `paymentMethod` is the
// already-humanized label (e.g. "MTN MoMo"), not the raw method id.
export interface SaleData {
  saleId: string;
  eventName: string;
  eventDate?: string;
  venue?: string;
  ticketTypeName: string;
  unitPrice: number;
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
