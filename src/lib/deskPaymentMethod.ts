/** Payments received at a desk; external receipts are confirmed on a separate device. */
export type DeskTopupMethod = 'cash' | 'card' | 'deltapay' | 'mobile_money';
export interface DeskTopupTotals {
  cashTopups: number;
  cardTopups: number;
  deltapayTopups: number;
  mobileMoneyTopups: number;
}
export function deskPaymentMethodLabel(method: string | undefined): string {
  switch (method) {
    case 'cash': return 'Cash';
    case 'card': return 'Card';
    case 'deltapay': return 'DeltaPay';
    case 'mobile_money': return 'Mobile Money';
    case 'office_cash': return 'Office cash';
    default: throw new Error('Missing or invalid desk payment method');
  }
}
