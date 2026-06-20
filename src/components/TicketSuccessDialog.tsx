import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BRAND_NAME } from '@/lib/brand';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, Printer, MessageSquare, MessageCircle } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';

interface TicketSuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saleData: {
    eventName: string;
    ticketTypeName: string;
    customerName: string;
    customerPhone: string;
    quantity: number;
    totalAmount: number;
    ticketIds: string[];
  };
}

export function TicketSuccessDialog({ open, onOpenChange, saleData }: TicketSuccessDialogProps) {
  const handlePrint = () => {
    // Create printable content with QR codes for each ticket
    const ticketsHtml = saleData.ticketIds.map((id, index) => `
      <div class="ticket">
        <h3>Ticket ${index + 1} of ${saleData.quantity}</h3>
        <p><span class="label">Ticket ID:</span> <span class="ticket-id">${id}</span></p>
        <div class="qr-container">
          <canvas id="qr-${index}"></canvas>
        </div>
        <p class="qr-label">Scan this QR code at the event entrance</p>
      </div>
    `).join('');

    const printContent = `
      <html>
        <head>
          <title>Ticket Receipt</title>
          <style>
            @media print {
              @page { margin: 0.5cm; }
              body { margin: 0; }
            }
            body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
            h1 { color: #ea580c; text-align: center; border-bottom: 3px solid #ea580c; padding-bottom: 15px; margin-bottom: 25px; }
            .section { margin: 20px 0; padding: 20px; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb; }
            .label { font-weight: bold; color: #374151; }
            .ticket {
              page-break-inside: avoid;
              margin: 25px 0;
              padding: 25px;
              border: 3px solid #ea580c;
              border-radius: 12px;
              background: white;
            }
            .ticket h3 { margin: 0 0 15px 0; color: #ea580c; font-size: 18px; }
            .ticket-id { font-family: monospace; background: #fef3c7; padding: 2px 8px; border-radius: 4px; }
            .qr-container { text-align: center; margin: 20px 0; }
            .qr-label { text-align: center; font-size: 13px; color: #6b7280; margin-top: 10px; }
            h2 { color: #ea580c; margin: 30px 0 20px 0; font-size: 20px; }
          </style>
        </head>
        <body>
          <h1>🎫 ${BRAND_NAME} - Receipt</h1>
          <div class="section">
            <p><span class="label">Event:</span> ${saleData.eventName}</p>
            <p><span class="label">Ticket Type:</span> ${saleData.ticketTypeName}</p>
            <p><span class="label">Customer:</span> ${saleData.customerName}</p>
            <p><span class="label">Phone:</span> ${saleData.customerPhone}</p>
            <p><span class="label">Quantity:</span> ${saleData.quantity}</p>
            <p><span class="label">Total Amount:</span> E ${saleData.totalAmount.toLocaleString()}</p>
          </div>

          <h2>Your Tickets:</h2>
          ${ticketsHtml}

          <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
          <script>
            ${saleData.ticketIds.map((id, index) => `
              QRCode.toCanvas(document.getElementById('qr-${index}'), '${id}', {
                width: 220,
                margin: 2,
                color: {
                  dark: '#000000',
                  light: '#FFFFFF'
                }
              }, function(error) {
                if (error) console.error(error);
              });
            `).join('\n')}

            // Auto print when QR codes are loaded
            setTimeout(function() {
              window.print();
            }, 600);
          </script>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
    }
  };

  const handleSendSMS = () => {
    // SMS: Simple text with just ticket IDs (no QR codes)
    const message = `Your ${saleData.eventName} ticket(s): ${saleData.quantity}x ${saleData.ticketTypeName}. Ticket ID(s): ${saleData.ticketIds.join(', ')}`;
    const phoneNumber = saleData.customerPhone.replace(/^\+/, '');
    window.location.href = `sms:${phoneNumber}?body=${encodeURIComponent(message)}`;
  };

  const handleSendWhatsApp = () => {
    // WhatsApp: Include ticket details with QR code instructions
    const ticketList = saleData.ticketIds.map((id, i) => `${i + 1}. ${id}`).join('\n');
    const message = `🎫 *${BRAND_NAME}*\n\n*Event:* ${saleData.eventName}\n*Ticket Type:* ${saleData.ticketTypeName}\n*Customer:* ${saleData.customerName}\n*Quantity:* ${saleData.quantity}\n*Total:* E ${saleData.totalAmount.toLocaleString()}\n\n*Your Ticket ID(s):*\n${ticketList}\n\n✅ Save these ticket IDs - you'll need them at the event!\n📱 Show your printed tickets with QR codes for faster entry.\n\nSee you at the event! 🎉`;

    const phoneNumber = saleData.customerPhone.replace(/^\+/, '').replace(/\s/g, '');
    window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`, '_blank');
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

              {/* Ticket IDs */}
              <div className="border-t border-orange-200 pt-4">
                <p className="text-sm text-slate-600 font-medium mb-2">Ticket ID(s)</p>
                <div className="flex flex-wrap gap-2">
                  {saleData.ticketIds.map((id, index) => (
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
            {/* Print Button */}
            <Button
              variant="outline"
              size="lg"
              className="w-full h-16 flex items-center justify-center gap-3 border-2 border-slate-300 hover:border-slate-400 hover:bg-slate-50 transition-all duration-200 text-base font-semibold group"
              onClick={handlePrint}
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 group-hover:bg-slate-200 transition-colors">
                <Printer className="h-5 w-5 text-slate-700" />
              </div>
              <span>Print Tickets with QR Codes</span>
            </Button>

            {/* SMS Button */}
            <Button
              variant="outline"
              size="lg"
              className="w-full h-16 flex items-center justify-center gap-3 border-2 border-blue-300 hover:border-blue-400 hover:bg-blue-50 transition-all duration-200 text-base font-semibold group"
              onClick={handleSendSMS}
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 group-hover:bg-blue-200 transition-colors">
                <MessageSquare className="h-5 w-5 text-blue-700" />
              </div>
              <span className="text-blue-700">Send via SMS</span>
            </Button>

            {/* WhatsApp Button */}
            <Button
              size="lg"
              className="w-full h-16 flex items-center justify-center gap-3 bg-gradient-to-r from-[#25D366] to-[#128C7E] hover:from-[#20BD5A] hover:to-[#0F7A68] text-white shadow-lg hover:shadow-xl transition-all duration-200 text-base font-semibold group"
              onClick={handleSendWhatsApp}
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white/20 group-hover:bg-white/30 transition-colors">
                <MessageCircle className="h-5 w-5 text-white fill-white" />
              </div>
              <span>Send via WhatsApp</span>
            </Button>
          </div>

          {/* Close Button */}
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
