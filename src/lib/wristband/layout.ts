import { bandPitchMm, type CalibrationOffset, type SheetTemplate } from './templates';

/** 1 pt = 1/72 inch; 1 inch = 25.4 mm. */
export const MM_TO_PT = 72 / 25.4;
/** Band render resolution — photo quality on an inkjet. */
export const PRINT_DPI = 600;

export function mmToPt(mm: number): number {
  return mm * MM_TO_PT;
}

/** Millimetres → whole pixels at PRINT_DPI (Konva pixelRatio maths). */
export function mmToPrintPx(mm: number): number {
  return Math.round((mm / 25.4) * PRINT_DPI);
}

export interface BandRectPt {
  xPt: number;
  yPt: number;
  widthPt: number;
  heightPt: number;
}

/**
 * Distance from the page top to each band's TOP edge, band 1 first — the one
 * place band spacing is decided. Everything that positions bands (PDF writer,
 * sheet preview, calibration page) reads this, so screen and paper cannot
 * disagree about where band i goes.
 *
 * Spacing is the template's measured pitch plus the calibration nudge. It is
 * NOT derived from bandHeightMm: an error there is multiplied by the band
 * index, so a 6.4mm-per-band mistake puts band 8 a full 45mm out even while
 * band 1 looks perfect.
 */
export function bandTopsMm(template: SheetTemplate, offset: CalibrationOffset): number[] {
  const pitch = bandPitchMm(template) + offset.dPitchMm;
  return Array.from(
    { length: template.bandsPerSheet },
    (_, i) => template.marginTopMm + offset.dyMm + i * pitch
  );
}

/**
 * Die-cut band positions in PDF page coordinates (origin bottom-left, y UP),
 * top band first. Calibration is expressed in printed orientation (+dx right,
 * +dy down), so a larger top-mm becomes a SMALLER PDF y.
 */
export function bandRectsPt(template: SheetTemplate, offset: CalibrationOffset): BandRectPt[] {
  return bandTopsMm(template, offset).map((topMm) => ({
    xPt: mmToPt(template.marginLeftMm + offset.dxMm),
    yPt: mmToPt(template.pageHeightMm - topMm - template.bandHeightMm),
    widthPt: mmToPt(template.bandWidthMm),
    heightPt: mmToPt(template.bandHeightMm),
  }));
}

/**
 * Band pitch implied by a span measured across the whole sheet (band 1 top ->
 * band N top). Always prefer this to measuring one gap: a ±0.5mm ruler error
 * on a 10-band span becomes ±0.06mm of pitch, while the same error on a single
 * gap becomes ±0.5mm — which is 4.5mm of drift by the last band.
 */
export function pitchFromSpanMm(spanMm: number, bandsPerSheet: number): number {
  if (bandsPerSheet < 2) {
    throw new Error('Need at least 2 bands to derive pitch from a span');
  }
  return spanMm / (bandsPerSheet - 1);
}
