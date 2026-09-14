import { it, expect } from 'vitest';
import { buildTicketReceiptHtml } from '@/lib/ticketReceipt';
import type { SaleData } from '@/lib/saleData';

const base: SaleData = {
  saleId: '66b1f0c2a4d3e5f6a7b8c9d0',
  eventName: 'Bushfire',
  ticketTypeName: '2 × General',
  unitPrice: 150,
  customerName: 'Thandi Dlamini',
  customerPhone: '+26876123456',
  quantity: 2,
  totalAmount: 300,
  paymentMethod: 'Cash',
  operatorName: 'Box Office',
  ticketIds: ['T1', 'T2'],
};

const tickets = [
  { ticketId: 'T1', qrDataUrl: 'data:image/png;base64,AAA' },
  { ticketId: 'T2', qrDataUrl: 'data:image/png;base64,BBB' },
];

it('prints Qty x Price for a single-tier sale', () => {
  const html = buildTicketReceiptHtml(base, tickets, null);
  expect(html).toContain('Qty x Price');
  expect(html).toContain('2 x E 150');
  expect(html).toContain('E 300');
});

// A mixed basket has no single unit price. It must still print — the organizer
// portal shipped a SaleData without unitPrice and every print threw
// "Cannot read properties of undefined (reading 'toLocaleString')".
it('omits the unit-price row when the basket has no single unit price', () => {
  const { unitPrice: _unitPrice, ...mixed } = base;
  const html = buildTicketReceiptHtml(
    { ...mixed, ticketTypeName: '1 × VIP, 2 × General', quantity: 3, totalAmount: 600 },
    tickets,
    null,
  );
  expect(html).not.toContain('Qty x Price');
  expect(html).toContain('<span class="k">Qty</span>');
  // The total — the figure the customer actually pays — is still printed, and
  // no fabricated per-ticket price appears anywhere.
  expect(html).toContain('E 600');
});

it('uses the event currency symbol on the total', () => {
  const html = buildTicketReceiptHtml({ ...base, currency: 'ZAR' }, tickets, null);
  expect(html).toContain('R 300');
});
