import html2canvas from 'html2canvas';
import {
  buildTicketReceiptHtml,
  buildSingleTicketHtml,
  type ReceiptTicket,
} from '@/lib/ticketReceipt';
import type { SaleData } from '@/lib/saleData';

// The native POS shell (carrot-tickets-pos) wraps this dashboard in a WebView
// and injects window.CarrotPrinter via a JS channel. When present we rasterize
// each ticket to a PNG and post them over the bridge for silent thermal
// printing on the Senraise H10. In a plain browser the bridge is absent and we
// fall back to the 58mm print dialog.
interface CarrotPrinterBridge {
  postMessage?: (message: string) => void;
}
declare global {
  interface Window {
    CarrotPrinter?: CarrotPrinterBridge;
  }
}

/**
 * Render one ticket fragment off-screen and rasterize it to a base64 PNG
 * (without the `data:image/png;base64,` prefix). All images inside are inline
 * data URLs, so there is no network dependency.
 */
async function renderTicketPng(html: string): Promise<string> {
  const holder = document.createElement('div');
  holder.style.position = 'fixed';
  holder.style.left = '-100000px';
  holder.style.top = '0';
  holder.style.width = '384px';
  holder.style.background = '#ffffff';
  holder.innerHTML = html;
  document.body.appendChild(holder);
  try {
    const canvas = await html2canvas(holder, {
      backgroundColor: '#ffffff',
      scale: 1,
      width: 384,
      windowWidth: 384,
    });
    return canvas.toDataURL('image/png').split(',')[1] ?? '';
  } finally {
    document.body.removeChild(holder);
  }
}

/**
 * Print the ticket(s).
 *
 * - Inside the POS shell: each ticket is rasterized to a PNG and sent over the
 *   CarrotPrinter bridge (one complete ticket per QR) for silent printing.
 * - In a plain browser: opens the 58mm receipt and triggers the print dialog.
 *
 * Returns false only when the browser print window is blocked (popup blocker),
 * so the caller can surface a toast. Throws if rasterization fails — the caller
 * surfaces that too (never a silent success).
 */
export async function printTicket(
  sale: SaleData,
  tickets: ReceiptTicket[],
  logoDataUrl: string | null,
): Promise<boolean> {
  const bridge = window.CarrotPrinter;
  if (bridge && typeof bridge.postMessage === 'function') {
    const pngs: string[] = [];
    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      if (!ticket) continue;
      const html = buildSingleTicketHtml(sale, ticket, i, tickets.length, logoDataUrl);
      pngs.push(await renderTicketPng(html));
    }
    bridge.postMessage(JSON.stringify({ tickets: pngs }));
    return true;
  }

  const html = buildTicketReceiptHtml(sale, tickets, logoDataUrl);
  const printWindow = window.open('', '_blank');
  if (!printWindow) return false;
  printWindow.document.write(html);
  printWindow.document.close();
  return true;
}
