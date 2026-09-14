import { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, Printer, MessageSquare, MessageCircle, Loader2, Download } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { toast } from 'sonner';
import type { SaleData } from '@/lib/saleData';
import { printTicket } from '@/lib/printTicket';
import { getPrintLogoDataUrl } from '@/lib/printAssets';
import type { ReceiptTicket } from '@/lib/ticketReceipt';
import { formatMoney } from '@/lib/currency';
import { TicketRecipientRow } from '@/components/TicketRecipientRow';
import { saveBlob, buildTicketsZip, downloadTicketBundles } from '@/lib/ticketDownloads';
import { MAX_RECIPIENT_ROWS, SCROLL_RECIPIENT_ROWS_ABOVE } from '@/lib/ticketRecipients';
import type { SendChannel, TicketRecipient } from '@/types';

interface TicketSuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saleData: SaleData;
  /**
   * How to (re)send the ticket SMS for this sale. The organizer and reseller
   * rails authenticate with different tokens and hit different endpoints, so
   * the owning page supplies its own — the dialog must not guess from whichever
   * token happens to be in localStorage.
   */
  sendSms: (saleId: string) => Promise<{ sent: boolean }>;
  /** Supplied only by surfaces that support per-ticket recipients (the organizer
   *  portal). Omitted by the reseller POS, which then renders today's dialog. */
  perTicket?: {
    setRecipient: (ticketId: string, r: TicketRecipient) => Promise<unknown>;
    send: (ticketId: string, channel: SendChannel) => Promise<{ sent: boolean }>;
    downloadOne: (ticketId: string) => Promise<void>;
    // Declared here, consumed in Task 8 — defining the full shape up front keeps
    // Task 7's tests valid once the bulk-download buttons land.
    downloadBundle: (ticketIds: string[]) => Promise<Blob>;
    fetchOneBlob: (ticketId: string) => Promise<Blob>;
  };
}

export function TicketSuccessDialog({ open, onOpenChange, saleData, sendSms, perTicket }: TicketSuccessDialogProps) {
  const qrRefs = useRef<Array<HTMLCanvasElement | null>>([]);
  const [printing, setPrinting] = useState(false);
  const [sendingSms, setSendingSms] = useState(false);
  const [bundling, setBundling] = useState(false);
  const [zipping, setZipping] = useState(false);

  const handlePrint = async () => {
    setPrinting(true);
    try {
      const tickets: ReceiptTicket[] = saleData.ticketIds.map((ticketId, i) => {
        const canvas = qrRefs.current[i];
        // The offscreen QR canvases are mounted whenever the dialog is open, so
        // toDataURL is available synchronously and offline (no CDN).
        const qrDataUrl = canvas ? canvas.toDataURL('image/png') : '';
        return { ticketId, qrDataUrl };
      });

      const logoDataUrl = await getPrintLogoDataUrl();
      const ok = await printTicket(saleData, tickets, logoDataUrl);
      if (!ok) {
        toast.error('Could not open the print view. Allow pop-ups and try again.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? `Print failed: ${err.message}` : 'Print failed');
    } finally {
      setPrinting(false);
    }
  };

  const handleSendSMS = async () => {
    if (!saleData.saleId) {
      toast.error('This sale cannot be re-sent (missing reference).');
      return;
    }
    setSendingSms(true);
    try {
      const { sent } = await sendSms(saleData.saleId);
      if (sent) {
        toast.success(`Ticket SMS sent to ${saleData.customerPhone}`);
      } else {
        toast.error('SMS was not accepted by the gateway. Please try again.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send SMS');
    } finally {
      setSendingSms(false);
    }
  };

  const handleDownloadAllPdf = async () => {
    if (!perTicket) return;
    setBundling(true);
    try {
      // Split at the API's 100-ticket bundle cap. Posting every id in one
      // call 400s on a basket the till was allowed to ring up, which left
      // the button offered for sales it could never serve — and disagreeing
      // with the ZIP button, which has no such cap.
      await downloadTicketBundles(saleData.ticketIds, perTicket.downloadBundle);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not build the ticket PDF');
    } finally {
      setBundling(false);
    }
  };

  const handleDownloadAllZip = async () => {
    if (!perTicket) return;
    setZipping(true);
    try {
      const zip = await buildTicketsZip(saleData.ticketIds, perTicket.fetchOneBlob);
      saveBlob(zip, 'tickets.zip');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not build the ZIP');
    } finally {
      setZipping(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-gradient-to-r from-green-500 to-emerald-500 p-2">
              <CheckCircle className="h-6 w-6 text-white" />
            </div>
            <DialogTitle className="text-2xl">Tickets Sold Successfully!</DialogTitle>
          </div>
        </DialogHeader>

        {/* Offscreen QR canvases — one per ticket — used to build the printed
            receipt offline. Mounted while the dialog is open. */}
        <div aria-hidden className="absolute h-0 w-0 overflow-hidden opacity-0">
          {saleData.ticketIds.map((id, i) => (
            <QRCodeCanvas
              key={id}
              value={id}
              size={240}
              level="M"
              ref={(el) => { qrRefs.current[i] = el; }}
            />
          ))}
        </div>

        <div className="space-y-6 py-4">
          {/* Ticket Details Card */}
          <Card className="border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50">
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-600 font-medium">Event</p>
                  <p className="text-lg font-semibold text-slate-900">{saleData.eventName}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 font-medium">Ticket Type</p>
                  <p className="text-lg font-semibold text-slate-900">{saleData.ticketTypeName}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 font-medium">Customer</p>
                  <p className="text-lg font-semibold text-slate-900">{saleData.customerName}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 font-medium">Phone</p>
                  <p className="text-lg font-semibold text-slate-900">{saleData.customerPhone}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 font-medium">Quantity</p>
                  <p className="text-lg font-semibold text-slate-900">{saleData.quantity}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 font-medium">Total Amount</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {formatMoney(saleData.totalAmount, saleData.currency ?? 'SZL', { space: true, decimals: 0 })}
                  </p>
                </div>
              </div>

              <div className="border-t border-orange-200 pt-4">
                <p className="text-sm text-slate-600 font-medium mb-2">Ticket ID(s)</p>
                {perTicket && (
                  <div className="flex flex-wrap gap-2 pb-2">
                    <Button size="sm" variant="outline" disabled={bundling} onClick={handleDownloadAllPdf}>
                      {bundling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      <span className="ml-1">Download all (PDF)</span>
                    </Button>
                    <Button size="sm" variant="outline" disabled={zipping} onClick={handleDownloadAllZip}>
                      {zipping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      <span className="ml-1">Download all (ZIP)</span>
                    </Button>
                  </div>
                )}
                {perTicket && saleData.ticketIds.length <= MAX_RECIPIENT_ROWS ? (
                  // Long sales SCROLL rather than losing their rows: the till
                  // panel captures a recipient per ticket with the same cap,
                  // so dropping to chips above 20 stranded every send and
                  // download the operator had just been allowed to set up.
                  <div
                    data-testid="recipient-rows"
                    className={
                      saleData.ticketIds.length > SCROLL_RECIPIENT_ROWS_ABOVE
                        ? 'max-h-80 overflow-y-auto pr-1'
                        : undefined
                    }
                  >
                    {saleData.ticketIds.map((id) => (
                      <TicketRecipientRow
                        key={id}
                        ticketId={id}
                        recipient={saleData.ticketRecipients?.[id]}
                        onSetRecipient={perTicket.setRecipient}
                        onSend={perTicket.send}
                        onDownload={perTicket.downloadOne}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {saleData.ticketIds.map((id) => (
                      <span
                        key={id}
                        className="px-3 py-1 bg-white border border-orange-300 rounded-md text-sm font-mono"
                      >
                        {id}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="space-y-4">
            {/* Print */}
            <Button
              variant="outline"
              size="lg"
              disabled={printing}
              className="w-full h-16 flex items-center justify-center gap-3 border-2 border-slate-300 hover:border-slate-400 hover:bg-slate-50 transition-all duration-200 text-base font-semibold group"
              onClick={handlePrint}
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 group-hover:bg-slate-200 transition-colors">
                {printing ? <Loader2 className="h-5 w-5 animate-spin text-slate-700" /> : <Printer className="h-5 w-5 text-slate-700" />}
              </div>
              <span>Print Tickets with QR Codes</span>
            </Button>

            {/* SMS — server-side via CarrotTix */}
            <Button
              variant="outline"
              size="lg"
              disabled={sendingSms}
              className="w-full h-16 flex items-center justify-center gap-3 border-2 border-blue-300 hover:border-blue-400 hover:bg-blue-50 transition-all duration-200 text-base font-semibold group"
              onClick={handleSendSMS}
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 group-hover:bg-blue-200 transition-colors">
                {sendingSms ? <Loader2 className="h-5 w-5 animate-spin text-blue-700" /> : <MessageSquare className="h-5 w-5 text-blue-700" />}
              </div>
              <span className="text-blue-700">{sendingSms ? 'Sending SMS…' : 'Send via SMS'}</span>
            </Button>

            {/* WhatsApp — coming soon (disabled) */}
            <Button
              variant="outline"
              size="lg"
              disabled
              aria-disabled
              className="w-full h-16 flex items-center justify-center gap-3 border-2 border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed text-base font-semibold"
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-200">
                <MessageCircle className="h-5 w-5 text-slate-400" />
              </div>
              <span>Send via WhatsApp</span>
              <span className="ml-1 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-500">
                Coming soon
              </span>
            </Button>
          </div>

          {/* Close */}
          <Button
            variant="ghost"
            size="lg"
            className="w-full h-12 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all duration-200 font-medium"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
