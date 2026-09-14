import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/PhoneInput';
import { Loader2, Download, Send } from 'lucide-react';
import type { SaleTicketRecipient } from '@/lib/saleData';
import type { SendChannel, TicketRecipient } from '@/types';

interface Props {
  ticketId: string;
  /**
   * Who the API already minted this ticket for — the recipient the till
   * captured, or the sale's buyer. Seeds the row so the operator does not
   * have to retype three names from memory in the right order (one
   * transposition sends the VIP ticket to the wrong phone and still reports
   * success), and so a send that the API would accept is not blocked by the
   * row's own guard.
   */
  recipient?: SaleTicketRecipient;
  onSetRecipient: (ticketId: string, r: TicketRecipient) => Promise<unknown>;
  onSend: (ticketId: string, channel: SendChannel) => Promise<{ sent: boolean }>;
  onDownload: (ticketId: string) => Promise<void>;
}

type SendState =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent' }
  | { kind: 'failed'; reason: string };

/** One box-office ticket's recipient + send controls, rendered inline in the
 *  success dialog. Every ticket in a multi-ticket sale gets its own row so
 *  each can go to a different person — its own contact fields, its own
 *  channel, its own send/failure state. Never a shared/batch verdict: a
 *  failure on TKT-2 must not touch TKT-1's row, and a failed DOWNLOAD must
 *  not repaint a green "Sent" red (at a till that reads as "not sent" and
 *  buys a second SMS credit). */
export function TicketRecipientRow({ ticketId, recipient, onSetRecipient, onSend, onDownload }: Props) {
  const storedName = recipient?.name?.trim() ?? '';
  const storedPhone = recipient?.phone?.trim() ?? '';
  const storedEmail = recipient?.email?.trim() ?? '';

  const [name, setName] = useState(storedName);
  const [phone, setPhone] = useState(storedPhone);
  const [email, setEmail] = useState(storedEmail);
  // Start on whichever channel this ticket can actually be sent on.
  const [channel, setChannel] = useState<SendChannel>(
    !storedPhone && storedEmail ? 'email' : 'sms'
  );
  const [state, setState] = useState<SendState>({ kind: 'idle' });
  const [downloading, setDownloading] = useState(false);
  // Its OWN slot. Sharing the send slot meant a failed download erased a
  // successful send's verdict, and a stale send failure survived a later
  // successful download.
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const typed = (channel === 'sms' ? phone : email).trim();
  const stored = channel === 'sms' ? storedPhone : storedEmail;

  const handleSend = async () => {
    // Guard BEFORE the API call: a send spends a credit either way. But the
    // TICKET is the authority on who it goes to, and the API only rejects
    // when the ticket itself has no contact — so a row seeded from the till
    // sends without retyping. Only a row with nothing typed AND nothing
    // stored is genuinely unsendable.
    if (!typed && !stored) {
      setState({
        kind: 'failed',
        reason: channel === 'sms'
          ? 'Add a phone number to send by SMS'
          : 'Add an email address to send by email',
      });
      return;
    }
    if (channel === 'email' && typed && !typed.includes('@')) {
      setState({ kind: 'failed', reason: 'Add an email address to send by email' });
      return;
    }

    setState({ kind: 'sending' });
    try {
      // The ticket is the single source of truth for who it goes to, so
      // persist any EDIT first, then send. setRecipient can 409 when the
      // ticket has already been scanned — that message surfaces as-is. A row
      // left exactly as the till captured it needs no PATCH (and the API
      // rejects an empty body anyway).
      const next: TicketRecipient = {
        ...(name.trim() ? { name: name.trim() } : {}),
        ...(typed ? (channel === 'sms' ? { phone: typed } : { email: typed }) : {}),
      };
      const edited = typed !== stored || name.trim() !== storedName;
      if (edited && Object.keys(next).length > 0) {
        await onSetRecipient(ticketId, next);
      }
      const { sent } = await onSend(ticketId, channel);
      setState(sent ? { kind: 'sent' } : { kind: 'failed', reason: 'Not accepted by the gateway' });
    } catch (err) {
      setState({ kind: 'failed', reason: err instanceof Error ? err.message : 'Failed to send' });
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      await onDownload(ticketId);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 py-2 last:border-b-0">
      <span className="font-mono text-xs w-32 shrink-0">{ticketId}</span>
      {/* Name beside the id: three identical blank rows are indistinguishable,
          and the operator has no way to tell which is Thandi's. */}
      {name.trim() && (
        <span className="max-w-[9rem] truncate text-xs font-medium text-slate-700" title={name.trim()}>
          {name.trim()}
        </span>
      )}

      <Input
        aria-label={`Recipient name for ${ticketId}`}
        placeholder="Name"
        className="h-9 w-32"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      {/* A bare phone box silently localises a foreign number: 0821234567
          becomes +268821234567, routes to the Eswatini gateway, and still
          reports "Sent". The country picker is what stops that. */}
      {channel === 'sms' ? (
        <PhoneInput
          compact
          className="w-64"
          value={phone}
          onChange={setPhone}
          placeholder="7612 3456"
          inputAriaLabel={`Recipient contact for ${ticketId}`}
          countryAriaLabel={`Recipient country code for ${ticketId}`}
        />
      ) : (
        <Input
          type="email"
          aria-label={`Recipient contact for ${ticketId}`}
          placeholder="name@example.com"
          className="h-9 w-44"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      )}

      <select
        aria-label={`Send channel for ${ticketId}`}
        className="h-9 rounded-md border border-slate-300 px-2 text-sm"
        value={channel}
        onChange={(e) => { setChannel(e.target.value as SendChannel); setState({ kind: 'idle' }); }}
      >
        <option value="sms">SMS</option>
        <option value="email">Email</option>
      </select>

      <Button size="sm" onClick={handleSend} disabled={state.kind === 'sending'}>
        {state.kind === 'sending'
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : <Send className="h-4 w-4" />}
        <span className="ml-1">Send</span>
      </Button>

      <Button size="sm" variant="outline" onClick={handleDownload} disabled={downloading}>
        {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      </Button>

      {state.kind === 'sent' && <span className="text-xs font-medium text-green-600">Sent</span>}
      {state.kind === 'failed' && <span className="text-xs font-medium text-red-600">{state.reason}</span>}
      {downloadError && <span className="text-xs font-medium text-amber-700">Download: {downloadError}</span>}
    </div>
  );
}
