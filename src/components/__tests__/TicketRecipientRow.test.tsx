// @vitest-environment jsdom
import { afterEach, beforeAll, describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { TicketRecipientRow } from '@/components/TicketRecipientRow';
import type { TicketRecipient } from '@/types';

// Radix's Select needs pointer APIs jsdom does not implement; stubbing them
// lets the country listbox open from the keyboard.
beforeAll(() => {
  const proto = window.HTMLElement.prototype as unknown as Record<string, unknown>;
  proto['scrollIntoView'] = vi.fn();
  proto['hasPointerCapture'] = vi.fn();
  proto['releasePointerCapture'] = vi.fn();
  proto['setPointerCapture'] = vi.fn();
});

afterEach(cleanup);

const base = {
  ticketId: 'TKT-1',
  onSetRecipient: vi.fn().mockResolvedValue({}),
  onSend: vi.fn().mockResolvedValue({ sent: true }),
  onDownload: vi.fn().mockResolvedValue(undefined),
};

describe('TicketRecipientRow', () => {
  it('saves the recipient before sending', async () => {
    const calls: string[] = [];
    render(<TicketRecipientRow {...base}
      onSetRecipient={vi.fn(async () => { calls.push('save'); return {}; })}
      onSend={vi.fn(async () => { calls.push('send'); return { sent: true }; })} />);

    fireEvent.change(screen.getByLabelText('Recipient name for TKT-1'), { target: { value: 'Thandi' } });
    fireEvent.change(screen.getByLabelText('Recipient contact for TKT-1'), { target: { value: '+26876111111' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => expect(calls).toEqual(['save', 'send']));
    expect(await screen.findByText(/sent/i)).toBeTruthy();
  });

  it('shows the failure reason on that row and does not claim success', async () => {
    render(<TicketRecipientRow {...base}
      onSend={vi.fn().mockRejectedValue(new Error('Gateway did not accept the message'))} />);

    fireEvent.change(screen.getByLabelText('Recipient contact for TKT-1'), { target: { value: '+26876111111' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    expect(await screen.findByText(/gateway did not accept/i)).toBeTruthy();
    expect(screen.queryByText(/^sent$/i)).toBeNull();
  });

  it('refuses to send SMS with no phone, before calling the API', async () => {
    const onSend = vi.fn();
    render(<TicketRecipientRow {...base} onSend={onSend} />);
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() => expect(screen.getByText(/add a phone number/i)).toBeTruthy());
    expect(onSend).not.toHaveBeenCalled();
  });
});

describe('TicketRecipientRow — foreign recipient numbers (C1)', () => {
  // A bare phone box let 0821234567 through; normalizePhone turned it into
  // +268821234567, isValidPhone accepted it, SmsService routed it to the
  // Eswatini gateway, and the row still painted a green "Sent".
  it('offers a country picker rather than a bare phone box', () => {
    render(<TicketRecipientRow {...base} />);
    expect(screen.getByLabelText('Recipient country code for TKT-1')).toBeTruthy();
  });

  // THE regression: an operator serving a South African customer types the
  // local 821234567 and picks ZA. Before the picker existed, that shipped as
  // bare digits, normalizePhone made it +268821234567, SmsService routed it to
  // the Eswatini gateway, and the row painted a green "Sent" anyway.
  it('sends to the country the operator picked, not Eswatini', async () => {
    const onSetRecipient = vi.fn().mockResolvedValue({});
    render(<TicketRecipientRow {...base} onSetRecipient={onSetRecipient} />);

    fireEvent.change(screen.getByLabelText('Recipient contact for TKT-1'), { target: { value: '821234567' } });
    fireEvent.keyDown(screen.getByLabelText('Recipient country code for TKT-1'), { key: 'ArrowDown' });
    fireEvent.click(await screen.findByRole('option', { name: /South Africa/i }));

    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() => expect(onSetRecipient).toHaveBeenCalled());
    expect(onSetRecipient.mock.calls[0]![1]).toEqual({ phone: '+27821234567' });
  });

  it('persists a South African number in full international form', async () => {
    const onSetRecipient = vi.fn().mockResolvedValue({});
    render(<TicketRecipientRow {...base} onSetRecipient={onSetRecipient} />);

    fireEvent.change(screen.getByLabelText('Recipient contact for TKT-1'), {
      target: { value: '+27821234567' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => expect(onSetRecipient).toHaveBeenCalled());
    expect(onSetRecipient.mock.calls[0]![1]).toEqual({ phone: '+27821234567' });
    // Not silently re-prefixed with the Eswatini dial code.
    expect(onSetRecipient.mock.calls[0]![1].phone).not.toMatch(/^\+268/);
  });

  // The dropdown re-derives itself from a pasted international number, so the
  // operator can see which gateway the ticket is headed for.
  it('shows the pasted number\'s own country, not the default', async () => {
    render(<TicketRecipientRow {...base} />);
    fireEvent.change(screen.getByLabelText('Recipient contact for TKT-1'), {
      target: { value: '+27821234567' },
    });
    await waitFor(() =>
      expect(screen.getByLabelText('Recipient country code for TKT-1').textContent).toContain('+27')
    );
  });
});

describe('TicketRecipientRow — seeded from the till (I1)', () => {
  const seeded = { name: 'Thandi', phone: '+26876111111' };

  it('sends a stored recipient without making the operator retype it', async () => {
    const onSend = vi.fn().mockResolvedValue({ sent: true });
    const onSetRecipient = vi.fn().mockResolvedValue({});
    render(<TicketRecipientRow {...base} recipient={seeded} onSend={onSend} onSetRecipient={onSetRecipient} />);

    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => expect(onSend).toHaveBeenCalledWith('TKT-1', 'sms'));
    // Nothing was edited, so nothing needed re-persisting.
    expect(onSetRecipient).not.toHaveBeenCalled();
    expect(await screen.findByText(/^sent$/i)).toBeTruthy();
    expect(screen.queryByText(/add a phone number/i)).toBeNull();
  });

  it('names the row so three tickets are not three identical blanks', () => {
    render(<TicketRecipientRow {...base} recipient={seeded} />);
    expect(screen.getByText('Thandi')).toBeTruthy();
    expect((screen.getByLabelText('Recipient name for TKT-1') as HTMLInputElement).value).toBe('Thandi');
    expect((screen.getByLabelText('Recipient contact for TKT-1') as HTMLInputElement).value).toBe('76111111');
  });

  // Editing a seeded row must still reach the ticket before the send — the
  // ticket, not the row, is what the API sends to.
  it('persists an edit to a seeded row before sending', async () => {
    const calls: string[] = [];
    const onSetRecipient = vi.fn(async (_id: string, _r: TicketRecipient) => { calls.push('save'); return {}; });
    render(<TicketRecipientRow {...base} recipient={seeded}
      onSetRecipient={onSetRecipient}
      onSend={vi.fn(async () => { calls.push('send'); return { sent: true }; })} />);

    fireEvent.change(screen.getByLabelText('Recipient contact for TKT-1'), { target: { value: '+27821234567' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => expect(calls).toEqual(['save', 'send']));
    expect(onSetRecipient.mock.calls[0]![1]).toEqual({ name: 'Thandi', phone: '+27821234567' });
  });

  it('starts on email when the ticket only has an email address', async () => {
    const onSend = vi.fn().mockResolvedValue({ sent: true });
    render(<TicketRecipientRow {...base} recipient={{ email: 'thandi@example.com' }} onSend={onSend} />);

    expect((screen.getByLabelText('Send channel for TKT-1') as HTMLSelectElement).value).toBe('email');
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() => expect(onSend).toHaveBeenCalledWith('TKT-1', 'email'));
  });
});

describe('TicketRecipientRow — download failures (I3)', () => {
  // Sharing one state slot turned a green "Sent" red on a later download
  // failure. At a till that reads as "not sent" and buys a second credit.
  it('does not overwrite a successful send', async () => {
    render(<TicketRecipientRow {...base}
      recipient={{ phone: '+26876111111' }}
      onDownload={vi.fn().mockRejectedValue(new Error('PDF still generating'))} />);

    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    expect(await screen.findByText(/^sent$/i)).toBeTruthy();

    // The download button is the icon-only one — the Send button carries text.
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[buttons.length - 1]!);

    expect(await screen.findByText(/pdf still generating/i)).toBeTruthy();
    expect(screen.getByText(/^sent$/i)).toBeTruthy();
  });

  it('clears a stale download error on the next successful download', async () => {
    const onDownload = vi.fn()
      .mockRejectedValueOnce(new Error('PDF still generating'))
      .mockResolvedValueOnce(undefined);
    render(<TicketRecipientRow {...base} onDownload={onDownload} />);

    const buttons = screen.getAllByRole('button');
    const download = buttons[buttons.length - 1]!;
    fireEvent.click(download);
    expect(await screen.findByText(/pdf still generating/i)).toBeTruthy();

    fireEvent.click(download);
    await waitFor(() => expect(screen.queryByText(/pdf still generating/i)).toBeNull());
  });
});
