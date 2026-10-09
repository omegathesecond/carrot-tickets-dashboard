/** Desk payments are received as cash or approved on a separate card machine. */
export function deskPaymentMethodLabel(method: string | undefined): string {
  switch (method) {
    case 'cash': return 'Cash';
    case 'card': return 'Card';
    case 'office_cash': return 'Office cash';
    default: throw new Error('Missing or invalid desk payment method');
  }
}
