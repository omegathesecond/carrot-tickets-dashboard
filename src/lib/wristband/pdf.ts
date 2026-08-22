import { PDFDocument, degrees, rgb, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib';
import type { CalibrationOffset, SheetTemplate } from './templates';
import { bandRectsMm, bandRectsPt, bandTopsMm, mmToPt } from './layout';
import { sheetMeasurements } from './sheetChecks';

/**
 * Assemble the print PDF: pages at the template's EXACT physical size, each
 * band PNG drawn at its die-cut position (+ calibration). PNG embedding in
 * pdf-lib is lossless — the 600 DPI renders are not recompressed. Printed at
 * "Actual size", 1pt here is exactly 1/72" on paper.
 *
 * Under a 180-degree flip the artwork turns with the page. QR codes survive
 * it — the finder patterns tell a scanner which way up the code is — so a
 * flipped sheet still scans at the gate.
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
      // pdf-lib rotates about the anchor point, so a 180-degree image runs
      // DOWN and LEFT from it — anchor at the rect's far corner to land it
      // back inside the same rectangle.
      page.drawImage(png, offset.flip180
        ? {
            x: r.xPt + r.widthPt, y: r.yPt + r.heightPt,
            width: r.widthPt, height: r.heightPt, rotate: degrees(180),
          }
        : { x: r.xPt, y: r.yPt, width: r.widthPt, height: r.heightPt });
    }
  }
  return doc.save();
}

/** Length of the printed reference bar used to detect driver scaling. */
const RULER_LENGTH_MM = 100;

/**
 * Calibration test page: band outlines, tab keep-out lines, and two printed
 * rulers. Hold it against a Tyvek sheet on a window/light; nudge dx/dy until
 * the outlines sit on the die-cuts.
 *
 * The rulers exist because "print at Actual size" is advice nobody can verify.
 * A driver silently scaling to fit produces the same signature as a wrong
 * template — band 1 near enough, every later band worse — so the page carries
 * its own known distances to measure back.
 */
export async function buildCalibrationPdf(
  template: SheetTemplate, offset: CalibrationOffset
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([mmToPt(template.pageWidthMm), mmToPt(template.pageHeightMm)]);
  const rects = bandRectsPt(template, offset);
  const tops = bandTopsMm(template, offset);
  const tabAtLeft = bandRectsMm(template, offset)[0]?.tabAtLeft ?? false;

  rects.forEach((r, i) => {
    page.drawRectangle({
      x: r.xPt, y: r.yPt, width: r.widthPt, height: r.heightPt,
      borderColor: rgb(0.1, 0.1, 0.1), borderWidth: 0.5,
    });
    // Tab keep-out marker — right end normally, left end once flipped.
    const tabX = tabAtLeft
      ? r.xPt + mmToPt(template.tabZoneMm)
      : r.xPt + r.widthPt - mmToPt(template.tabZoneMm);
    page.drawLine({
      start: { x: tabX, y: r.yPt }, end: { x: tabX, y: r.yPt + r.heightPt },
      color: rgb(0.6, 0.6, 0.6), thickness: 0.5,
    });
    // Labels stay upright even on a flipped page: they are read off the proof
    // while aligning it, not worn on a wrist.
    page.drawText(`band ${i + 1}`, {
      x: tabAtLeft ? r.xPt + r.widthPt - 30 : r.xPt + 4,
      y: r.yPt + r.heightPt / 2 - 3, size: 6, font, color: rgb(0.4, 0.4, 0.4),
    });
  });

  drawScaleRuler(page, font, template);
  drawSpanMarker(page, font, template, tops, sheetMeasurements(template, offset).spanMm);

  // ASCII-safe: WinAnsi cannot encode the curly punctuation in template names.
  page.drawText(
    `Template: ${template.key} - dx=${offset.dxMm}mm dy=${offset.dyMm}mm pitch${offset.dPitchMm >= 0 ? '+' : ''}${offset.dPitchMm}mm${offset.flip180 ? ' - FLIPPED 180' : ''}`,
    { x: mmToPt(4), y: mmToPt(1.5), size: 7, font, color: rgb(0, 0, 0) }
  );
  return doc.save();
}

/**
 * A known-length bar with mm ticks, printed across the middle of the page.
 * If it does not measure RULER_LENGTH_MM with a real ruler, the printer is
 * scaling and no amount of calibration will fix the drift — the driver has to
 * be set to Actual size / 100% / no page scaling.
 */
function drawScaleRuler(
  page: PDFPage, font: PDFFont, template: SheetTemplate
): void {
  const lengthMm = Math.min(RULER_LENGTH_MM, template.pageWidthMm - 20);
  const x0 = mmToPt(template.pageWidthMm / 2 - lengthMm / 2);
  const y0 = mmToPt(template.pageHeightMm / 2);
  const ink = rgb(0.85, 0.15, 0.25);

  page.drawLine({
    start: { x: x0, y: y0 }, end: { x: x0 + mmToPt(lengthMm), y: y0 },
    color: ink, thickness: 0.8,
  });
  for (let mm = 0; mm <= lengthMm; mm += 5) {
    const major = mm % 10 === 0;
    page.drawLine({
      start: { x: x0 + mmToPt(mm), y: y0 },
      end: { x: x0 + mmToPt(mm), y: y0 + (major ? 8 : 4) },
      color: ink, thickness: major ? 0.8 : 0.4,
    });
    if (major && mm % 20 === 0) {
      page.drawText(String(mm), {
        x: x0 + mmToPt(mm) + 1, y: y0 + 10, size: 5, font, color: ink,
      });
    }
  }
  page.drawText(
    `This bar is exactly ${lengthMm}mm. If it measures anything else, printing is scaled - set the printer to Actual size / 100%, no "fit to page".`,
    { x: x0, y: y0 - 9, size: 6, font, color: ink }
  );
}

/**
 * The whole-sheet span, marked from the topmost band's edge down to the
 * lowest. This is the single number to check against the real Tyvek: it is
 * what band spacing multiplies up to, and measuring it across every band
 * divides ruler error by N-1.
 *
 * Measured by page extremes, never band[0]-to-band[last]: a flipped page puts
 * band 1 at the BOTTOM, which printed the span as "-171.0mm" — not a distance
 * anyone can hold a ruler against.
 */
function drawSpanMarker(
  page: PDFPage, font: PDFFont, template: SheetTemplate, topsMm: number[], spanMm: number
): void {
  if (topsMm.length < 2) return;
  // Clear of the "band N" labels, which start ~1.5mm in and run ~7mm wide.
  const x = mmToPt(template.marginLeftMm + 12);
  const yTop = mmToPt(template.pageHeightMm - Math.min(...topsMm));
  const yBottom = mmToPt(template.pageHeightMm - Math.max(...topsMm));
  const ink = rgb(0.1, 0.35, 0.75);

  page.drawLine({ start: { x, y: yTop }, end: { x, y: yBottom }, color: ink, thickness: 0.8 });
  for (const y of [yTop, yBottom]) {
    page.drawLine({
      start: { x: x - 5, y }, end: { x: x + 5, y }, color: ink, thickness: 0.8,
    });
  }
  page.drawText(`top band to bottom band = ${spanMm.toFixed(1)}mm`, {
    x: x + 7, y: (yTop + yBottom) / 2, size: 6, font, color: ink,
  });
}

/** Open a generated PDF in a new tab for the OS print dialog. Fails loudly. */
export function openPdf(bytes: Uint8Array): void {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (!win) throw new Error('Popup blocked — allow popups for this site to print wristbands.');
}
