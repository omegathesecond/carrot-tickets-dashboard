export const PAYMENT_LABEL: Record<string, string> = {
  cash: 'Cash',
  keshless_wallet: 'Wallet',
  mtn_momo: 'MoMo',
};

export function paymentLabel(method: string): string {
  return PAYMENT_LABEL[method] ?? method;
}
