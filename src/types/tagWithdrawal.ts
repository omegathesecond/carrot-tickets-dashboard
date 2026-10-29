export type TagWithdrawalStatus = 'pending' | 'processing' | 'paid' | 'rejected';
export interface TagWithdrawalRequest {
  _id: string; eventId: string; walletId: string; eventName: string; bandUid: string;
  amount: number; currency: 'SZL' | 'ZAR'; country: 'SZ' | 'ZA'; method: 'mobile_money' | 'bank_transfer';
  status: TagWithdrawalStatus; destinationSummary: string; processingBy?: string;
  paymentReference?: string; paidAt?: string; rejectionReason?: string; createdAt: string;
  history: Array<{ status: TagWithdrawalStatus; at: string; by: string; note?: string }>;
  details?: { fullName: string; contactPhone: string; email?: string; mobileNumber?: string; provider?: string;
    bank?: { country: string; bank: string; accountHolder: string; accountType: string; accountNumber: string; branchCode: string } };
}
