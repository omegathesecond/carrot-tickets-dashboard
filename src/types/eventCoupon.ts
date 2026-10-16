export interface EventCoupon {
  _id: string;
  code: string;
  label: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  ticketTypeIds: string[];
  expiresAt?: string;
  status: 'available' | 'pending' | 'used' | 'expired' | 'disabled';
  redemption: { saleId: string; customerName?: string; usedAt?: string; discountAmount: number } | null;
}

export interface CreateCouponsInput {
  count: number;
  label: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  ticketTypeIds: string[];
  expiresAt?: string;
}
