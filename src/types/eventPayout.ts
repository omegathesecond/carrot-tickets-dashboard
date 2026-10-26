export interface PayoutBank {
  version?: string;
  country: string;
  bank: string;
  accountType: string;
  branchCode: string;
  accountHolder: string;
  accountNumber: string;
}
export type PayoutStatus = 'pending' | 'approved' | 'declined' | 'paid';
export interface PayoutBreakdown {
  sales: number;
  gross: number;
  refunds: number;
  platformFees: number;
  resellerCommission: number;
  absorbedFees: number;
  organizerProceeds: number;
  vendorHeld: number;
  unremitted: number;
  vendorFees: number;
  adjustments: number;
  previouslyPaid: number;
  availableBalance: number;
}
export interface EventPayoutRequest {
  _id: string;
  eventId: string;
  vendorId: string;
  eventName: string;
  eventDate: string;
  organizerName: string;
  currency: 'SZL' | 'ZAR';
  amount: number;
  breakdown: PayoutBreakdown;
  bank: PayoutBank;
  status: PayoutStatus;
  createdAt: string;
  history: { status: PayoutStatus; at: string; by: string; note?: string }[];
  paidAt?: string;
  paymentReference?: string;
  currentBreakdown?: PayoutBreakdown;
  balanceError?: string;
}
export interface EventPayoutOverview {
  eventId: string;
  eventName: string;
  eventDate: string;
  currency: 'SZL' | 'ZAR';
  eligible: boolean;
  reason: string | null;
  breakdown: PayoutBreakdown;
  requests: EventPayoutRequest[];
}
