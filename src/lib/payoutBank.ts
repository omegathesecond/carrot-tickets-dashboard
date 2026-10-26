import type { PayoutBank } from '@/types/eventPayout';

export const BANK_FIELDS: { key: keyof PayoutBank; label: string }[] = [
  { key: 'country', label: 'Country' },
  { key: 'bank', label: 'Bank' },
  { key: 'accountType', label: 'Account type' },
  { key: 'branchCode', label: 'Branch code' },
  { key: 'accountHolder', label: 'Account holder name' },
  { key: 'accountNumber', label: 'Account number' },
];

export function maskPayoutAccount(account: string): string {
  return `••••${account.slice(-Math.min(4, Math.floor(account.length / 2)))}`;
}
