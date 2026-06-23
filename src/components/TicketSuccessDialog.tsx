import { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, Printer, MessageSquare, MessageCircle, Loader2 } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { toast } from 'sonner';
import type { SaleData } from '@/lib/saleData';
import { printTicket } from '@/lib/printTicket';
import { getPrintLogoDataUrl } from '@/lib/printAssets';
import type { ReceiptTicket } from '@/lib/ticketReceipt';
import { resellerApi } from '@/lib/resellerApi';

interface TicketSuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saleData: SaleData;
}

export function TicketSuccessDialog({ open, onOpenChange, saleData }: TicketSuccessDialogProps) {
  const qrRefs = useRef<Array<HTMLCanvasElement | null>>([]);
  const [printing, setPrinting] = useState(false);
  const [sendingSms, setSendingSms] = useState(false);

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
      const { sent } = await resellerApi.sendSaleSms(saleData.saleId);
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
                    E {saleData.totalAmount.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="border-t border-orange-200 pt-4">
                <p className="text-sm text-slate-600 font-medium mb-2">Ticket ID(s)</p>
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
