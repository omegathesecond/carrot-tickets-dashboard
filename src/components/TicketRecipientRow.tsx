import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Download, Send } from 'lucide-react';
import type { SendChannel, TicketRecipient } from '@/types';

interface Props {
  ticketId: string;
  onSetRecipient: (ticketId: string, r: TicketRecipient) => Promise<unknown>;
  onSend: (ticketId: string, channel: SendChannel) => Promise<{ sent: boolean }>;
  onDownload: (ticketId: string) => Promise<void>;
}

type RowState =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent' }
  | { kind: 'failed'; reason: string };

/** One box-office ticket's recipient + send controls, rendered inline in the
 *  success dialog. Every ticket in a multi-ticket sale gets its own row so
 *  each can go to a different person — its own contact fields, its own
 *  channel, its own send/failure state. Never a shared/batch verdict: a
 *  failure on TKT-2 must not touch TKT-1's row. */
export function TicketRecipientRow({ ticketId, onSetRecipient, onSend, onDownload }: Props) {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [channel, setChannel] = useState<SendChannel>('sms');
  const [state, setState] = useState<RowState>({ kind: 'idle' });
  const [downloading, setDownloading] = useState(false);

  const handleSend = async () => {
    // Guard BEFORE the API call: a send spends a credit either way, so an
    // empty contact field must never reach onSend.
    if (channel === 'sms' && !contact.trim()) {
      setState({ kind: 'failed', reason: 'Add a phone number to send by SMS' });
      return;
    }
    if (channel === 'email' && !contact.includes('@')) {
      setState({ kind: 'failed', reason: 'Add an email address to send by email' });
      return;
    }

    setState({ kind: 'sending' });
    try {
      // The ticket is the single source of truth for who it goes to, so
      // persist the recipient first, then send. setRecipient can 409 when
      // the ticket has already been scanned — that message surfaces as-is.
      await onSetRecipient(ticketId, {
        ...(name.trim() ? { name: name.trim() } : {}),
        ...(channel === 'sms' ? { phone: contact.trim() } : { email: contact.trim() }),
      });
      const { sent } = await onSend(ticketId, channel);
      setState(sent ? { kind: 'sent' } : { kind: 'failed', reason: 'Not accepted by the gateway' });
    } catch (err) {
      setState({ kind: 'failed', reason: err instanceof Error ? err.message : 'Failed to send' });
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await onDownload(ticketId);
    } catch (err) {
      setState({ kind: 'failed', reason: err instanceof Error ? err.message : 'Download failed' });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 py-2 last:border-b-0">
      <span className="font-mono text-xs w-32 shrink-0">{ticketId}</span>

      <Input
        aria-label={`Recipient name for ${ticketId}`}
        placeholder="Name"
        className="h-9 w-32"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <Input
        aria-label={`Recipient contact for ${ticketId}`}
        placeholder={channel === 'sms' ? '7612 3456' : 'name@example.com'}
        className="h-9 w-44"
        value={contact}
        onChange={(e) => setContact(e.target.value)}
      />

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
    </div>
  );
}
