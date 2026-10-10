import { expect, it } from 'vitest';
import { deskPaymentMethodLabel } from '../deskPaymentMethod';
it('labels four distinct receipt methods without treating external money as cash or card', () => {
  expect(['cash', 'card', 'deltapay', 'mobile_money'].map(deskPaymentMethodLabel)).toEqual(['Cash', 'Card', 'DeltaPay', 'Mobile Money']);
  expect(() => deskPaymentMethodLabel('unknown')).toThrow('Missing or invalid');
});
