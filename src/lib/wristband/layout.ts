import type { CalibrationOffset, SheetTemplate } from './templates';

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
 * Die-cut band positions in PDF page coordinates (origin bottom-left, y UP),
 * top band first. Calibration is expressed in printed orientation (+dx right,
 * +dy down), so dy is SUBTRACTED from the PDF y.
 */
export function bandRectsPt(template: SheetTemplate, offset: CalibrationOffset): BandRectPt[] {
  const rects: BandRectPt[] = [];
  for (let i = 0; i < template.bandsPerSheet; i++) {
    const topMm = template.marginTopMm + i * (template.bandHeightMm + template.gapYMm);
    rects.push({
      xPt: mmToPt(template.marginLeftMm + offset.dxMm),
      yPt: mmToPt(template.pageHeightMm - topMm - template.bandHeightMm - offset.dyMm),
      widthPt: mmToPt(template.bandWidthMm),
      heightPt: mmToPt(template.bandHeightMm),
    });
  }
  return rects;
}
