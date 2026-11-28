export const PAYMENT_LABEL: Record<string, string> = {
  cash: 'Cash',
  pos_payment: 'POS payment',
  keshless_wallet: 'Wallet',
  mtn_momo: 'MoMo',
  peach_card: 'Card',
  deltapay: 'DeltaPay',
  yoco: 'Card (Yoco)',
  yebopay: 'Card (YeboPay)',
};

export function paymentLabel(method: string): string {
  return PAYMENT_LABEL[method] ?? method;
}
