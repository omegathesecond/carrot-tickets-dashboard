import { expect, it } from 'vitest';
import { deskPaymentMethodLabel } from '../deskPaymentMethod';
it('labels four distinct receipt methods without treating external money as cash or card', () => {
  expect(['cash', 'card', 'deltapay', 'mobile_money'].map(deskPaymentMethodLabel)).toEqual(['Cash', 'Card', 'DeltaPay', 'Mobile Money']);
  expect(() => deskPaymentMethodLabel('unknown')).toThrow('Missing or invalid');
});

it('labels completed attendee bank and office withdrawals in event history', () => {
  expect(deskPaymentMethodLabel('bank_transfer')).toBe('Bank transfer');
  expect(deskPaymentMethodLabel('office_cash')).toBe('Office cash');
});
