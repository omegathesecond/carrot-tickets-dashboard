import { BRAND_NAME, SUPPORT_EMAIL } from '@/lib/brand';
import type { SaleData } from '@/lib/saleData';

export interface ReceiptTicket {
  ticketId: string;
  qrDataUrl: string; // PNG data URL generated offline from the ticketId
}

// Escape values interpolated into the receipt HTML so a customer name with
// angle brackets/ampersands can't break the markup.
function esc(value: string | number | undefined | null): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDateTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// Short, human-readable reference from the Mongo sale id (last 6 chars, upper).
function shortRef(saleId: string): string {
  return saleId ? saleId.slice(-6).toUpperCase() : '';
}

/**
 * Build a self-contained HTML document for a 58mm thermal printer. All images
 * (logo + QR) are inline data URLs, so the document needs no network. It calls
 * window.print() on load and closes itself afterwards.
 */
export function buildTicketReceiptHtml(
  sale: SaleData,
  tickets: ReceiptTicket[],
  logoDataUrl: string | null,
): string {
  const printedAt = new Date().toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const logoHtml = logoDataUrl
    ? `<img class="logo" src="${esc(logoDataUrl)}" alt="${esc(BRAND_NAME)}" />`
    : '';

  const ticketsHtml = tickets.map((t, i) => `
    <div class="ticket">
      <div class="ticket-no">TICKET ${i + 1} OF ${tickets.length}</div>
      <img class="qr" src="${esc(t.qrDataUrl)}" alt="QR ${esc(t.ticketId)}" />
      <div class="code">${esc(t.ticketId)}</div>
    </div>
    ${i < tickets.length - 1 ? '<div class="perf"></div>' : ''}
  `).join('');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${esc(BRAND_NAME)} Ticket</title>
<style>
  @page { size: 58mm auto; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    width: 58mm;
    padding: 2mm 2.5mm;
    font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
    color: #000;
    font-size: 11px;
    line-height: 1.35;
  }
  .center { text-align: center; }
  .logo { display: block; margin: 0 auto 2px; width: 40px; height: 40px; object-fit: contain; }
  .brand { text-align: center; font-weight: 800; font-size: 15px; letter-spacing: 0.5px; }
  .event { text-align: center; font-weight: 700; font-size: 13px; margin-top: 4px; }
  .muted { text-align: center; font-size: 10px; color: #000; }
  .rule { border-top: 1px dashed #000; margin: 6px 0; }
  .row { display: flex; justify-content: space-between; gap: 6px; font-size: 10.5px; }
  .row .k { color: #000; }
  .row .v { font-weight: 700; text-align: right; }
  .total { font-size: 13px; font-weight: 800; }
  .ticket { text-align: center; margin: 6px 0; }
  .ticket-no { font-weight: 800; font-size: 11px; margin-bottom: 3px; letter-spacing: 0.5px; }
  .qr { width: 150px; height: 150px; image-rendering: pixelated; }
  .code { font-family: "Courier New", monospace; font-weight: 700; font-size: 11px; margin-top: 2px; word-break: break-all; }
  .perf { border-top: 2px dashed #000; margin: 8px 0; }
  .instr { font-size: 10px; margin-top: 4px; }
  .instr ol { margin: 3px 0 0; padding-left: 16px; }
  .instr li { margin: 1px 0; }
  .foot { text-align: center; font-size: 9.5px; margin-top: 6px; }
</style>
</head>
<body>
  ${logoHtml}
  <div class="brand">${esc(BRAND_NAME)}</div>
  <div class="event">${esc(sale.eventName)}</div>
  ${sale.eventDate ? `<div class="muted">${esc(formatDateTime(sale.eventDate))}</div>` : ''}
  ${sale.venue ? `<div class="muted">${esc(sale.venue)}</div>` : ''}

  <div class="rule"></div>

  <div class="row"><span class="k">Type</span><span class="v">${esc(sale.ticketTypeName)}</span></div>
  <div class="row"><span class="k">Customer</span><span class="v">${esc(sale.customerName)}</span></div>
  <div class="row"><span class="k">Phone</span><span class="v">${esc(sale.customerPhone)}</span></div>
  <div class="row"><span class="k">Qty x Price</span><span class="v">${esc(sale.quantity)} x E ${esc(sale.unitPrice.toLocaleString())}</span></div>
  <div class="row total"><span class="k">TOTAL</span><span class="v">E ${esc(sale.totalAmount.toLocaleString())}</span></div>
  <div class="row"><span class="k">Payment</span><span class="v">${esc(sale.paymentMethod)}</span></div>
  ${sale.saleId ? `<div class="row"><span class="k">Ref</span><span class="v">${esc(shortRef(sale.saleId))}</span></div>` : ''}
  <div class="row"><span class="k">Sold by</span><span class="v">${esc(sale.operatorName)}</span></div>
  <div class="row"><span class="k">Printed</span><span class="v">${esc(printedAt)}</span></div>

  <div class="rule"></div>

  ${ticketsHtml}

  <div class="perf"></div>

  <div class="instr">
    <strong>Entry instructions</strong>
    <ol>
      <li>Keep this ticket safe — it is your proof of purchase.</li>
      <li>Show the QR code at the entrance to be scanned.</li>
      <li>Each QR admits one person and scans once only.</li>
      <li>No refunds or exchanges.</li>
    </ol>
  </div>

  <div class="foot">Support: ${esc(SUPPORT_EMAIL)}<br/>Thank you &amp; enjoy the event!</div>

  <script>
    window.onafterprint = function () { window.close(); };
    window.onload = function () { window.focus(); window.print(); };
  </script>
</body>
</html>`;
}
