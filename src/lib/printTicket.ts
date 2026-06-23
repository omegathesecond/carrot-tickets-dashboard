import { buildTicketReceiptHtml, type ReceiptTicket } from '@/lib/ticketReceipt';
import type { SaleData } from '@/lib/saleData';

// A future native WebView wrapper (for Sunmi/Telpo built-in printers) can expose
// window.CarrotPrinter.printTicketHtml; when present we hand it the receipt and
// skip the browser print dialog. Until then this branch is inert.
interface CarrotPrinterBridge {
  printTicketHtml?: (html: string) => void;
}
declare global {
  interface Window {
    CarrotPrinter?: CarrotPrinterBridge;
  }
}

/**
 * Print the 58mm ticket receipt. Returns false only when the browser-print path
 * couldn't open a window (popup blocked) so the caller can surface a toast.
 */
export function printTicket(
  sale: SaleData,
  tickets: ReceiptTicket[],
  logoDataUrl: string | null,
): boolean {
  const html = buildTicketReceiptHtml(sale, tickets, logoDataUrl);

  if (window.CarrotPrinter?.printTicketHtml) {
    window.CarrotPrinter.printTicketHtml(html);
    return true;
  }

  const printWindow = window.open('', '_blank');
  if (!printWindow) return false;
  printWindow.document.write(html);
  printWindow.document.close();
  return true;
}
