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

/** A band's place on the sheet, measured from the sheet's TOP-LEFT corner. */
export interface BandRectMm {
  xMm: number;
  topMm: number;
  widthMm: number;
  heightMm: number;
  /**
   * Which end of the band carries the adhesive tab. Normally the right end;
   * a 180-degree flip swaps it, because the whole sheet turned around.
   */
  tabAtLeft: boolean;
}

/**
 * Where every band actually lands on the paper — the single source of truth
 * for the PDF writer, the sheet preview and the calibration page, so screen
 * and paper cannot disagree about where band i goes.
 *
 * Built in three steps, in this order:
 *
 *  1. Template geometry. Spacing is the measured pitch, NOT bandHeightMm +
 *     gapYMm: an error there is multiplied by the band index, so a 6.4mm
 *     mistake puts band 8 a full 45mm out while band 1 still looks perfect.
 *  2. The 180-degree flip, for stock that can only be fed the other way round
 *     (an adhesive edge the printer will not take first). Rotating the sheet
 *     to load it rotates the print with it, so the page has to be rotated to
 *     cancel out — which mirrors band positions about the sheet centre and
 *     moves the tab to the other end of each band.
 *  3. Calibration dx/dy LAST, so they always mean what the user sees coming
 *     out of the printer: +dx right, +dy down on the finished sheet, flipped
 *     or not. Applying them before the flip would silently invert both.
 *
 * Band 1 stays index 0 whatever the flip does — it is the first band of the
 * batch, not the topmost one. When flipped it comes out at the BOTTOM.
 */
export function bandRectsMm(template: SheetTemplate, offset: CalibrationOffset): BandRectMm[] {
  const pitch = bandPitchMm(template) + offset.dPitchMm;

  return Array.from({ length: template.bandsPerSheet }, (_, i) => {
    const xMm = template.marginLeftMm;
    const topMm = template.marginTopMm + i * pitch;
    const base = offset.flip180
      ? {
          xMm: template.pageWidthMm - xMm - template.bandWidthMm,
          topMm: template.pageHeightMm - topMm - template.bandHeightMm,
        }
      : { xMm, topMm };

    return {
      xMm: base.xMm + offset.dxMm,
      topMm: base.topMm + offset.dyMm,
      widthMm: template.bandWidthMm,
      heightMm: template.bandHeightMm,
      tabAtLeft: offset.flip180,
    };
  });
}

/** Distance from the sheet top to each band's top edge, band 1 first. */
export function bandTopsMm(template: SheetTemplate, offset: CalibrationOffset): number[] {
  return bandRectsMm(template, offset).map((r) => r.topMm);
}

/**
 * The same rects in PDF page coordinates (origin bottom-left, y UP).
 *
 * A flipped page still draws each band into an upright rectangle here — the
 * rectangle has moved, but the ARTWORK inside it has not turned around yet.
 * Rotating the image is the PDF writer's job (see buildWristbandPdf), because
 * only it holds the pixels.
 */
export function bandRectsPt(template: SheetTemplate, offset: CalibrationOffset): BandRectPt[] {
  return bandRectsMm(template, offset).map((r) => ({
    xPt: mmToPt(r.xMm),
    yPt: mmToPt(template.pageHeightMm - r.topMm - r.heightMm),
    widthPt: mmToPt(r.widthMm),
    heightPt: mmToPt(r.heightMm),
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
