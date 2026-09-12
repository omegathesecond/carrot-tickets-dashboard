// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { TicketRecipientRow } from '@/components/TicketRecipientRow';

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
