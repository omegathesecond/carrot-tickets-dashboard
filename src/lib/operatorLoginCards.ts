import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import { saveBlob } from '@/lib/ticketDownloads';

export interface LoginCardIdentity {
  operatorName: string;
  stallName: string;
  phoneNumber?: string;
}
export interface LoginCard extends LoginCardIdentity { loginCode: string; pin: string }
export interface LoginCardTarget extends LoginCardIdentity { id: string; loginCode: string }
export type LoginExportFormat = 'images' | 'pdfs' | 'print';
const slug = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase();
export const loginCardFilename = (card: LoginCard, extension: 'png' | 'pdf') => `${slug(card.operatorName)}__${slug(card.stallName)}__${card.loginCode}.${extension}`;
const escapeXml = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);
function lines(text: string, width = 29): string[] {
  const words = text.trim().split(/\s+/).flatMap(word => word.match(new RegExp(`.{1,${width}}`, 'gu'))!);
  const result: string[] = [];
  for (const word of words) {
    if (result.length && result[result.length - 1]!.length + word.length + 1 <= width) result[result.length - 1] += ` ${word}`;
    else result.push(word);
  }
  return result;
}
function validate(card: LoginCard) {
  if (!card.operatorName.trim() || !card.stallName.trim() || !/^[a-zA-Z0-9]{6}$/.test(card.loginCode) || !/^\d{6}$/.test(card.pin)) {
    throw new Error('The login card is incomplete. Check the person’s details and PIN.');
  }
}

/** Local artwork only: credentials never go to an image or PDF service. */
export function loginCardSvg(card: LoginCard): string {
  validate(card);
  const names = lines(card.operatorName, 18);
  const stalls = lines(card.stallName, 26);
  const nameY = 218, stallY = nameY + names.length * 64 + 32;
  const userY = stallY + stalls.length * 45 + (card.phoneNumber ? 86 : 48);
  const pinY = userY + 218;
  const height = Math.max(1200, pinY + 450);
  const textLines = (values: string[], x: number, y: number, step: number, size: number, bold = false) => values.map((line, i) => `<text x="${x}" y="${y + i * step}" font-size="${size}" font-weight="${bold ? 700 : 400}">${escapeXml(line)}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="${height}" viewBox="0 0 1080 ${height}">
  <rect width="1080" height="${height}" fill="#fff"/><rect width="1080" height="16" fill="#ea580c"/>
  <g font-family="Arial, sans-serif" fill="#0f172a">
  <text x="72" y="91" font-size="36" font-weight="700" fill="#c2410c">CARROT TICKETS</text>
  <text x="72" y="143" font-size="23" fill="#64748b">PERSONAL STALL LOGIN</text>
  ${textLines(names, 72, nameY, 64, 50, true)}
  ${textLines(stalls, 72, stallY, 45, 34)}
  ${card.phoneNumber ? `<text x="72" y="${userY - 35}" font-size="27" fill="#475569">Recipient: ${escapeXml(card.phoneNumber)}</text>` : ''}
  <rect x="72" y="${userY}" width="936" height="186" rx="20" fill="#f1f5f9"/>
  <text x="105" y="${userY + 47}" font-size="25" fill="#475569">USER ID</text>
  <text x="105" y="${userY + 137}" font-family="monospace" font-size="82" font-weight="700" letter-spacing="9">${escapeXml(card.loginCode)}</text>
  <rect x="72" y="${pinY}" width="936" height="186" rx="20" fill="#fff7ed"/>
  <text x="105" y="${pinY + 47}" font-size="25" fill="#9a3412">PIN</text>
  <text x="105" y="${pinY + 137}" font-family="monospace" font-size="82" font-weight="700" letter-spacing="9">${escapeXml(card.pin)}</text>
  <text x="72" y="${pinY + 252}" font-size="29" font-weight="700">How to sign in</text>
  <text x="72" y="${pinY + 300}" font-size="28">1. Open Carrot POS.</text>
  <text x="72" y="${pinY + 344}" font-size="28">2. Enter this User ID and PIN.</text>
  <text x="72" y="${height - 62}" font-size="26" font-weight="700" fill="#c2410c">For the named operator only.</text>
  </g></svg>`;
}

export async function renderLoginCard(card: LoginCard): Promise<Blob> {
  const svg = new Blob([loginCardSvg(card)], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svg);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Could not render the login image.')); image.src = url; });
    const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Image export is unavailable in this browser.');
    ctx.drawImage(image, 0, 0);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not save the login image.')), 'image/png'));
  } finally { URL.revokeObjectURL(url); }
}

/** One operator per page, also used for a single person's PDF. */
export async function buildLoginCardsPdf(images: Blob[]): Promise<Blob> {
  if (!images.length) throw new Error('No login cards to export.');
  const pdf = await PDFDocument.create();
  for (const image of images) {
    const png = await pdf.embedPng(await image.arrayBuffer());
    const page = pdf.addPage([595.28, 841.89]);
    const scale = Math.min((page.getWidth() - 72) / png.width, (page.getHeight() - 72) / png.height);
    const width = png.width * scale, height = png.height * scale;
    page.drawImage(png, { x: (page.getWidth() - width) / 2, y: (page.getHeight() - height) / 2, width, height });
  }
  return new Blob([await pdf.save() as BlobPart], { type: 'application/pdf' });
}

/** All-or-nothing: a failed PIN lookup never produces an incomplete pack. */
export async function loadLoginCards(targets: LoginCardTarget[], reveal: (id: string) => Promise<{ loginCode: string; pin: string }>): Promise<LoginCard[]> {
  if (!targets.length) throw new Error('No active till logins. Add people to the stalls first.');
  const cards: LoginCard[] = [];
  for (let start = 0; start < targets.length; start += 4) {
    const batch = targets.slice(start, start + 4);
    const results = await Promise.allSettled(batch.map(async target => {
      const credentials = await reveal(target.id);
      if (credentials.loginCode !== target.loginCode) throw new Error('The User ID changed. Refresh the staff list and try again.');
      const card = { operatorName: target.operatorName, stallName: target.stallName, phoneNumber: target.phoneNumber, ...credentials };
      validate(card); return card;
    }));
    for (const [i, result] of results.entries()) {
      if (result.status === 'rejected') throw new Error(`Could not prepare ${batch[i]!.operatorName} at ${batch[i]!.stallName}: ${result.reason instanceof Error ? result.reason.message : 'PIN lookup failed'}`);
      cards.push(result.value);
    }
  }
  return cards;
}

export async function downloadLoginCards(cards: LoginCard[], format: LoginExportFormat, name: string): Promise<void> {
  if (!cards.length) throw new Error('No login cards to export.');
  const ordered = [...cards].sort((a, b) => a.stallName.localeCompare(b.stallName) || a.operatorName.localeCompare(b.operatorName) || a.loginCode.localeCompare(b.loginCode));
  const images: Blob[] = [];
  for (const card of ordered) images.push(await renderLoginCard(card));
  if (format === 'print') { saveBlob(await buildLoginCardsPdf(images), `${slug(name)}__all-logins-print-pack.pdf`); return; }
  const zip = new JSZip();
  for (const [i, card] of ordered.entries()) {
    const ext = format === 'images' ? 'png' : 'pdf';
    const file = format === 'images' ? images[i]! : await buildLoginCardsPdf([images[i]!]);
    zip.file(`${slug(card.stallName)}/${loginCardFilename(card, ext)}`, file);
  }
  saveBlob(await zip.generateAsync({ type: 'blob' }), `${slug(name)}__individual-login-${format}.zip`);
}
