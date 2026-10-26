export interface Stall {
  size: string;
  power: boolean;
  water: boolean;
  shelter: boolean;
  ownGazebo: boolean;
}
export interface ProviderProfile {
  _id?: string;
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  country: string;
  regions: string[];
  categories: string[];
  currentMarkets: string;
  desiredMarkets: string;
  marketTypes: string[];
  availability: string[];
  stall: Stall;
  sellsFood: boolean;
}
export interface Certificate {
  _id: string;
  profileId: string;
  type: string;
  name: string;
  expiresAt?: string;
}
export interface Opportunity {
  eventId?: string | null;
  posterUrl?: string;
  _id: string;
  organiser: string;
  name: string;
  location: string;
  country: string;
  description: string;
  marketType: string;
  categories: string[];
  availability: string[];
  dates: string[];
  scope: 'date' | 'regular';
  applicationDeadline: string;
  paymentDeadline: string;
  capacity: number | null;
  stallSizes: string[];
  stall: Stall;
  currency: string;
  stallFee: number;
  feeTiers: { label: string; amount: number }[];
  optionalCharges: { label: string; amount: number }[];
  cancellationTerms: string;
  requiredCertificates: string[];
  foodCertificates: string[];
  status: string;
  approvedProviders?: number;
  remainingCapacity?: number | null;
  approvedByScope?: Record<string, number>;
}
export interface MarketApplication {
  _id: string;
  profileId: string;
  opportunityId: Pick<
    Opportunity,
    '_id' | 'name' | 'dates' | 'scope' | 'location' | 'status'
  >;
  profile: ProviderProfile;
  scopeKey: string;
  status: string;
  paymentStatus: string;
  createdAt: string;
  message?: string;
}
export interface MarketOptions {
  marketTypes: string[];
  availability: string[];
  certificateTypes: string[];
  regions: Record<string, string[]>;
}
export interface ProfilesResponse {
  items: ProviderProfile[];
  defaultProfileId?: string;
  certificates: Certificate[];
}

export interface OrganiserApplication {
  _id: string;
  scopeKey: string;
  profile: ProviderProfile;
  note: string;
  certificates: string[];
  status: string;
  paymentStatus: string;
  message?: string;
  createdAt: string;
  terms: {
    currency: string;
    stallFee: number;
    paymentDeadline: string;
    cancellationTerms: string;
  };
}
