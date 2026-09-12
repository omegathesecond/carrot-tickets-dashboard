// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { TicketSuccessDialog } from '@/components/TicketSuccessDialog';
import type { SaleData } from '@/lib/saleData';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

afterEach(cleanup);

const saleData: SaleData = {
  saleId: 's1', eventName: 'Gig', ticketTypeName: '2 × General',
  customerName: 'Walk-up', customerPhone: '+26878422613',
  quantity: 2, totalAmount: 200, paymentMethod: 'Cash',
  operatorName: 'Box Office', ticketIds: ['TKT-1', 'TKT-2'],
};

const props = {
  open: true, onOpenChange: vi.fn(), saleData,
  sendSms: vi.fn().mockResolvedValue({ sent: true }),
};

describe('TicketSuccessDialog per-ticket panel', () => {
  it('renders one row per ticket when perTicket is supplied', () => {
    render(<TicketSuccessDialog {...props} perTicket={{
      setRecipient: vi.fn().mockResolvedValue({}),
      send: vi.fn().mockResolvedValue({ sent: true }),
      downloadOne: vi.fn().mockResolvedValue(undefined),
      downloadBundle: vi.fn().mockResolvedValue(new Blob()),
      fetchOneBlob: vi.fn().mockResolvedValue(new Blob()),
    }} />);
    expect(screen.getByLabelText('Recipient name for TKT-1')).toBeTruthy();
    expect(screen.getByLabelText('Recipient name for TKT-2')).toBeTruthy();
  });

  // Pins the reseller POS, which passes no perTicket prop.
  it('renders exactly as before when perTicket is omitted', () => {
    render(<TicketSuccessDialog {...props} />);
    expect(screen.queryByLabelText('Recipient name for TKT-1')).toBeNull();
    expect(screen.getByText('TKT-1')).toBeTruthy(); // plain chip, as today
  });
});
