import type { Opportunity, MarketOptions } from '@/types/marketplace';
export const certificateLabel = (type: string) =>
  ({
    food_handling: 'Food handling certificate',
    kitchen_compliance: 'Kitchen compliance certificate',
    coa: 'Certificate of Acceptability (COA)',
    public_liability: 'Public liability insurance',
  })[type] || type;
export function newOpportunity(options: MarketOptions): Opportunity {
  return {
    _id: '',
    organiser: '',
    name: '',
    location: '',
    country: 'SZ',
    description: '',
    marketType: options.marketTypes[0],
    categories: [],
    availability: [],
    dates: [],
    scope: 'date',
    applicationDeadline: '',
    paymentDeadline: '',
    capacity: null,
    stallSizes: ['2 × 2 m', '3 × 3 m'],
    stall: {
      size: '2 × 2 m',
      power: false,
      water: false,
      shelter: false,
      ownGazebo: false,
    },
    currency: 'SZL',
    stallFee: 0,
    feeTiers: [],
    optionalCharges: [],
    cancellationTerms: '',
    requiredCertificates: [],
    foodCertificates: [],
    status: 'draft',
  };
}
