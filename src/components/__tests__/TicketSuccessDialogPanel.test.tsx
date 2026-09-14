// @vitest-environment jsdom
import { afterEach, beforeAll, describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { TicketSuccessDialog } from '@/components/TicketSuccessDialog';
import { MAX_BUNDLE_TICKETS } from '@/lib/ticketDownloads';
import { MAX_RECIPIENT_ROWS } from '@/lib/ticketRecipients';
import type { SaleData } from '@/lib/saleData';

// jsdom implements neither; saveBlob only needs them to exist.
beforeAll(() => {
  (URL as unknown as Record<string, unknown>)['createObjectURL'] = vi.fn(() => 'blob:mock');
  (URL as unknown as Record<string, unknown>)['revokeObjectURL'] = vi.fn();
});

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

const rails = () => ({
  setRecipient: vi.fn().mockResolvedValue({}),
  send: vi.fn().mockResolvedValue({ sent: true }),
  downloadOne: vi.fn().mockResolvedValue(undefined),
  downloadBundle: vi.fn().mockResolvedValue(new Blob(['pdf'])),
  fetchOneBlob: vi.fn().mockResolvedValue(new Blob(['pdf'])),
});

const saleOf = (n: number, extra: Partial<SaleData> = {}): SaleData => ({
  ...saleData,
  quantity: n,
  ticketIds: Array.from({ length: n }, (_, i) => `TKT-${i + 1}`),
  ...extra,
});

describe('TicketSuccessDialog — bundle cap (I4)', () => {
  // The API caps a bundle at 100 ids and 400s above it; two 100-qty tiers is
  // a reachable basket, and the ZIP button had no matching cap.
  it('never posts a single over-cap bundle request', async () => {
    const perTicket = rails();
    render(<TicketSuccessDialog {...props} saleData={saleOf(201)} perTicket={perTicket} />);

    fireEvent.click(screen.getByRole('button', { name: /download all \(pdf\)/i }));

    await waitFor(() => expect(perTicket.downloadBundle).toHaveBeenCalledTimes(3));
    for (const call of perTicket.downloadBundle.mock.calls) {
      expect((call[0] as string[]).length).toBeLessThanOrEqual(MAX_BUNDLE_TICKETS);
    }
    // Still every ticket, just split — the organizer gets all of them.
    expect(perTicket.downloadBundle.mock.calls.flatMap((c) => c[0] as string[])).toHaveLength(201);
  });

  it('leaves an ordinary sale as one request', async () => {
    const perTicket = rails();
    render(<TicketSuccessDialog {...props} perTicket={perTicket} />);
    fireEvent.click(screen.getByRole('button', { name: /download all \(pdf\)/i }));
    await waitFor(() => expect(perTicket.downloadBundle).toHaveBeenCalledTimes(1));
    expect(perTicket.downloadBundle).toHaveBeenCalledWith(['TKT-1', 'TKT-2']);
  });
});

describe('TicketSuccessDialog — row cap agrees with the till (I5)', () => {
  // The till panel captures one recipient per ticket up to MAX_RECIPIENT_ROWS.
  // Dropping to chips at 20 left a 50-ticket sale's recipients with no send
  // and no download button at all.
  it('still renders a row per ticket well above 20', () => {
    render(<TicketSuccessDialog {...props} saleData={saleOf(50)} perTicket={rails()} />);
    expect(screen.getByLabelText('Recipient name for TKT-21')).toBeTruthy();
    expect(screen.getByLabelText('Recipient name for TKT-50')).toBeTruthy();
  });

  it('scrolls the long list rather than dropping it', () => {
    render(<TicketSuccessDialog {...props} saleData={saleOf(50)} perTicket={rails()} />);
    expect(screen.getByTestId('recipient-rows').className).toContain('overflow-y-auto');
  });

  it('renders rows right up to the shared limit', () => {
    render(<TicketSuccessDialog {...props} saleData={saleOf(MAX_RECIPIENT_ROWS)} perTicket={rails()} />);
    expect(screen.getByLabelText(`Recipient name for TKT-${MAX_RECIPIENT_ROWS}`)).toBeTruthy();
  });
});

describe('TicketSuccessDialog — seeded rows (I1)', () => {
  it('seeds each row from the recipient the till already captured', () => {
    const sale = saleOf(2, {
      ticketRecipients: {
        'TKT-1': { name: 'Thandi', phone: '+26876111111' },
        'TKT-2': { name: 'Sipho', phone: '+27821234567' },
      },
    });
    render(<TicketSuccessDialog {...props} saleData={sale} perTicket={rails()} />);

    expect((screen.getByLabelText('Recipient name for TKT-1') as HTMLInputElement).value).toBe('Thandi');
    expect((screen.getByLabelText('Recipient name for TKT-2') as HTMLInputElement).value).toBe('Sipho');
    // Sipho's South African number keeps its own country, so the row cannot
    // be sent to the wrong gateway.
    expect(screen.getByLabelText('Recipient country code for TKT-2').textContent).toContain('+27');
    expect(screen.getByText('Thandi')).toBeTruthy();
    expect(screen.getByText('Sipho')).toBeTruthy();
  });
});
