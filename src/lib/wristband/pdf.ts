import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import type { CalibrationOffset, SheetTemplate } from './templates';
import { bandRectsPt, mmToPt } from './layout';

/**
 * Assemble the print PDF: pages at the template's EXACT physical size, each
 * band PNG drawn at its die-cut position (+ calibration). PNG embedding in
 * pdf-lib is lossless — the 600 DPI renders are not recompressed. Printed at
 * "Actual size", 1pt here is exactly 1/72" on paper.
 */
export async function buildWristbandPdf(opts: {
  template: SheetTemplate;
  offset: CalibrationOffset;
  pages: Uint8Array[][];
}): Promise<Uint8Array> {
  const { template, offset, pages } = opts;
  const rects = bandRectsPt(template, offset);
  const doc = await PDFDocument.create();

  for (const bandPngs of pages) {
    if (bandPngs.length > template.bandsPerSheet) {
      throw new Error(`Page has ${bandPngs.length} bands but template bandsPerSheet is ${template.bandsPerSheet}`);
    }
    const page = doc.addPage([mmToPt(template.pageWidthMm), mmToPt(template.pageHeightMm)]);
    for (let i = 0; i < bandPngs.length; i++) {
      const png = await doc.embedPng(bandPngs[i]);
      const r = rects[i];
      page.drawImage(png, { x: r.xPt, y: r.yPt, width: r.widthPt, height: r.heightPt });
    }
  }
  return doc.save();
}

/**
 * Calibration test page: band outlines + tab keep-out lines on plain paper.
 * Hold it against a Tyvek sheet on a window/light; nudge dx/dy until the
 * outlines sit on the die-cuts.
 */
export async function buildCalibrationPdf(
  template: SheetTemplate, offset: CalibrationOffset
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([mmToPt(template.pageWidthMm), mmToPt(template.pageHeightMm)]);
  const rects = bandRectsPt(template, offset);

  rects.forEach((r, i) => {
    page.drawRectangle({
      x: r.xPt, y: r.yPt, width: r.widthPt, height: r.heightPt,
      borderColor: rgb(0.1, 0.1, 0.1), borderWidth: 0.5,
    });
    // Tab keep-out marker at the band's right end.
    page.drawLine({
      start: { x: r.xPt + r.widthPt - mmToPt(template.tabZoneMm), y: r.yPt },
      end: { x: r.xPt + r.widthPt - mmToPt(template.tabZoneMm), y: r.yPt + r.heightPt },
      color: rgb(0.6, 0.6, 0.6), thickness: 0.5,
    });
    page.drawText(`band ${i + 1}`, {
      x: r.xPt + 4, y: r.yPt + r.heightPt / 2 - 3, size: 6, font, color: rgb(0.4, 0.4, 0.4),
    });
  });

  // Use ASCII-safe text to avoid WinAnsi encoding errors with Unicode chars in template names
  const calibrationText = `Template: ${template.key} — calibration  dx=${offset.dxMm}mm dy=${offset.dyMm}mm — print at ACTUAL SIZE`;
  page.drawText(
    calibrationText,
    { x: mmToPt(10), y: mmToPt(3), size: 8, font, color: rgb(0, 0, 0) }
  );
  return doc.save();
}

/** Open a generated PDF in a new tab for the OS print dialog. Fails loudly. */
export function openPdf(bytes: Uint8Array): void {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (!win) throw new Error('Popup blocked — allow popups for this site to print wristbands.');
}
