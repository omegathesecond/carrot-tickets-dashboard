export interface GuaranteeRequest {
  _id: string;
  eventId: string;
  providerId: string;
  eventName: string;
  organizerName: string;
  providerName: string;
  currency: string;
  amount: number;
  description: string;
  expectedPaymentDate: string;
  status: string;
  agreementName?: string;
  history: { status: string; at: string; by: string; note?: string }[];
}
export interface GuaranteeInput {
  providerId: string;
  amount: number;
  description: string;
  expectedPaymentDate: string;
}
export const guaranteeStatus = (status: string) => ({ requested: 'Awaiting provider', accepted: 'Provider accepted — awaiting Carrot review', provider_rejected: 'Provider rejected', withdrawn: 'Withdrawn', pending: 'Pending', paid: 'Paid', rejected: 'Rejected by Carrot' }[status] ?? status);
