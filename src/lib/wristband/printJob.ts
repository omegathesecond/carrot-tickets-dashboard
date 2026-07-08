import type { CalibrationOffset, SheetTemplate } from './templates';
import type { WristbandElement } from './design';
import { loadImages, renderBandPng } from './renderBand';
import { buildWristbandPdf } from './pdf';

/**
 * Page planning: which QR payload (ticketId) goes on which band of which
 * sheet. `null` band = render the design without a QR.
 */
export function planPages(
  ticketIds: string[] | null, sheets: number, bandsPerSheet: number
): (string | null)[][] {
  if (ticketIds === null) {
    if (sheets < 1) throw new Error('At least one sheet required');
    return Array.from({ length: sheets }, () => Array(bandsPerSheet).fill(null));
  }
  if (ticketIds.length === 0) throw new Error('No tickets selected');
  const pages: (string | null)[][] = [];
  for (let i = 0; i < ticketIds.length; i += bandsPerSheet) {
    pages.push(ticketIds.slice(i, i + bandsPerSheet));
  }
  return pages;
}

/** Render every band and assemble the final PDF. Fails loudly on any error. */
export async function runPrintJob(opts: {
  template: SheetTemplate;
  offset: CalibrationOffset;
  background: string;
  elements: WristbandElement[];
  pages: (string | null)[][];
  onProgress?: (done: number, total: number) => void;
}): Promise<Uint8Array> {
  const { template, offset, background, elements, pages, onProgress } = opts;
  const images = await loadImages(elements);
  const total = pages.reduce((n, p) => n + p.length, 0);
  let done = 0;

  let plainBand: Uint8Array | null = null; // no-QR bands are identical — render once
  const pngPages: Uint8Array[][] = [];
  for (const page of pages) {
    const bands: Uint8Array[] = [];
    for (const ticketId of page) {
      if (ticketId === null) {
        plainBand ??= await renderBandPng({ template, background, elements, images });
        bands.push(plainBand);
      } else {
        bands.push(await renderBandPng({ template, background, elements, images, qr: { ticketId } }));
      }
      onProgress?.(++done, total);
    }
    pngPages.push(bands);
  }
  return buildWristbandPdf({ template, offset, pages: pngPages });
}
