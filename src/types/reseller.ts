// Reseller Types

export interface Reseller {
  _id: string;
  businessName: string;
  slug?: string;
  email?: string;
  phoneNumber?: string;
  commissionPercent: number | null;
  status: 'active' | 'suspended';
  isActive: boolean;
  createdAt: string;
}

export interface ResellerHub {
  _id: string;
  resellerId: string;
  name: string;
  location?: {
    city?: string;
    region?: string;
  };
  isActive: boolean;
}

export interface ResellerOperator {
  _id: string;
  hubId: string;
  resellerId: string;
  fullName: string;
  loginCode: string;
  email?: string;
  phoneNumber?: string;
  role: string;
  isActive: boolean;
}

export interface ResellerSettlementPreview {
  cashOwedToCarrot: number;
  commissionOwedByCarrot: number;
  netAmount: number;
  byMethod: Record<string, number>;
}

export interface ResellerSettlement extends ResellerSettlementPreview {
  _id: string;
  resellerId: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  settledAt?: string;
  paymentReference?: string;
}

export interface HubOperatorStat {
  operatorId: string;
  fullName: string;
  loginCode: string;
  salesCount: number;
  revenue: number;
  ticketsSold: number;
}

export interface HubAnalytics {
  hubId: string;
  revenue: number;
  ticketsSold: number;
  salesCount: number;
  operatorsCount: number;
  byOperator: HubOperatorStat[];
}

export interface OrganizerPayoutPreview {
  proceedsOwed: number;
  feeOwedByVendor: number;
  availableProceeds: number;
  netAmount: number;
}

export interface OrganizerPayout extends OrganizerPayoutPreview {
  _id: string;
  vendorId: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  settledAt?: string;
  paymentReference?: string;
}
