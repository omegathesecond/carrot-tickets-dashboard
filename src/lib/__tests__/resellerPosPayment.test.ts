import { afterEach, expect, it, vi } from 'vitest';
import { resellerApi } from '../resellerApi';
import { paymentLabel } from '../payment';

afterEach(() => vi.unstubAllGlobals());
function mockResponse(data: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data })));
  vi.stubGlobal('localStorage', { getItem: () => 'operator-token' });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
it('offers the distinct POS method returned by the API', async () => {
  mockResponse({ methods: ['cash', 'pos_payment', 'mtn_momo'] });
  expect(await resellerApi.getPaymentMethods()).toMatchObject({ cash: true, pos_payment: true, mtn_momo: true });
  expect(paymentLabel('pos_payment')).toBe('POS payment');
});
it('submits POS payment without changing it to cash', async () => {
  const fetchMock = mockResponse({ saleId: 'sale', status: 'completed', tickets: [] });
  await resellerApi.createSale({ eventId: 'event', ticketTypeId: 'tier', quantity: 1, paymentMethod: 'pos_payment' });
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).paymentMethod).toBe('pos_payment');
});
