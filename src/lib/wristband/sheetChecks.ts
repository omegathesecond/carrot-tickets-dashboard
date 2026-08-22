import { bandPitchMm, TYPICAL_PRINTER_MARGIN_MM, type CalibrationOffset, type SheetTemplate } from './templates';
import { bandTopsMm } from './layout';

export type CheckLevel = 'error' | 'warning';

export interface SheetCheck {
  level: CheckLevel;
  /** What is wrong, in the units the user will measure with. */
  message: string;
  /** What to do about it. */
  fix: string;
}

/**
 * The numbers to hold a ruler against on a real sheet. Verifying these BEFORE
 * printing is the only way to catch a template that describes different stock
 * to the one in the tray — the preview alone cannot, because it draws from the
 * same template the PDF does.
 */
export interface SheetMeasurements {
  sheetWidthMm: number;
  sheetHeightMm: number;
  bandHeightMm: number;
  pitchMm: number;
  /** Band 1 top -> band N top. The highest-precision check available: a ruler
   *  error here is divided by N-1 when it is converted back to a pitch. */
  spanMm: number;
  /** Distance from the last band's bottom edge to the sheet's bottom edge. */
  bottomSlackMm: number;
  printableWidthMm: number;
}

export function sheetMeasurements(t: SheetTemplate, offset: CalibrationOffset): SheetMeasurements {
  const tops = bandTopsMm(t, offset);
  const lastBottom = tops[tops.length - 1] + t.bandHeightMm;
  return {
    sheetWidthMm: t.pageWidthMm,
    sheetHeightMm: t.pageHeightMm,
    bandHeightMm: t.bandHeightMm,
    pitchMm: bandPitchMm(t) + offset.dPitchMm,
    spanMm: tops[tops.length - 1] - tops[0],
    bottomSlackMm: t.pageHeightMm - lastBottom,
    printableWidthMm: t.bandWidthMm - t.tabZoneMm,
  };
}

/**
 * Every way this template can disagree with a real sheet, worst first.
 * Errors mean the sheet is guaranteed to print wrong; warnings mean it depends
 * on the printer.
 */
export function sheetChecks(t: SheetTemplate, offset: CalibrationOffset): SheetCheck[] {
  const checks: SheetCheck[] = [];
  const m = sheetMeasurements(t, offset);
  const pitch = m.pitchMm;

  if (pitch <= 0) {
    checks.push({
      level: 'error',
      message: `Band spacing is ${pitch.toFixed(2)}mm — bands would print on top of each other.`,
      fix: 'Set a positive pitch on the template, or reset the pitch nudge in Calibrate.',
    });
    return checks; // every other number is meaningless once pitch is nonsense
  }

  if (m.bottomSlackMm < -0.05) {
    const over = Math.abs(m.bottomSlackMm);
    // Would they fit even packed edge to edge? If not, the band height (or the
    // sheet size) is wrong and suggesting a smaller pitch just trades this
    // error for an overlap one.
    const tightest = t.marginTopMm + t.bandsPerSheet * t.bandHeightMm;
    const fittingPitch = (t.pageHeightMm - t.marginTopMm - t.bandHeightMm) / (t.bandsPerSheet - 1);
    checks.push({
      level: 'error',
      message: `The last band runs ${over.toFixed(1)}mm past the bottom of the sheet.`,
      fix: tightest > t.pageHeightMm
        ? `${t.bandsPerSheet} bands of ${t.bandHeightMm}mm need ${tightest.toFixed(0)}mm even with no gaps — this template is describing taller bands than the sheet holds. Measure a band and the sheet.`
        : `Set spacing to ${fittingPitch.toFixed(2)}mm, or measure band 1 top → band ${t.bandsPerSheet} top and enter it in Calibrate.`,
    });
  }

  if (t.bandHeightMm > pitch + 0.05) {
    checks.push({
      level: 'error',
      message: `Bands are ${t.bandHeightMm}mm tall but spaced only ${pitch.toFixed(2)}mm apart — each one overlaps the next die-cut.`,
      fix: 'Lower the band height or raise the pitch so height never exceeds spacing.',
    });
  }

  if (t.marginLeftMm + t.bandWidthMm > t.pageWidthMm + 0.05) {
    const over = t.marginLeftMm + t.bandWidthMm - t.pageWidthMm;
    checks.push({
      level: 'error',
      message: `Bands run ${over.toFixed(1)}mm past the right edge of the sheet.`,
      fix: `Set band width to ${(t.pageWidthMm - t.marginLeftMm).toFixed(1)}mm or less.`,
    });
  }

  if (t.tabZoneMm >= t.bandWidthMm) {
    checks.push({
      level: 'error',
      message: `The ${t.tabZoneMm}mm tab zone covers the whole ${t.bandWidthMm}mm band — nothing is printable.`,
      fix: 'Shrink the tab zone to the width of the glued end only.',
    });
  }

  // Full bleed: artwork sits inside the strip most printers cannot reach.
  const edgeGaps = [
    { name: 'top', mm: t.marginTopMm + offset.dyMm },
    { name: 'left', mm: t.marginLeftMm + offset.dxMm },
    { name: 'right', mm: t.pageWidthMm - t.marginLeftMm - offset.dxMm - t.bandWidthMm },
    { name: 'bottom', mm: m.bottomSlackMm },
  ].filter((e) => e.mm < TYPICAL_PRINTER_MARGIN_MM && e.mm >= -0.05);

  if (edgeGaps.length > 0) {
    checks.push({
      level: 'warning',
      message: `Artwork reaches the ${edgeGaps.map((e) => e.name).join(', ')} edge${edgeGaps.length > 1 ? 's' : ''} of the sheet, inside the ~${TYPICAL_PRINTER_MARGIN_MM}mm most printers cannot reach.`,
      fix: 'Turn on borderless printing, or keep artwork away from the band ends.',
    });
  }

  if (offset.dPitchMm !== 0) {
    checks.push({
      level: 'warning',
      message: `Calibration is stretching spacing by ${offset.dPitchMm > 0 ? '+' : ''}${offset.dPitchMm}mm per band — ${(offset.dPitchMm * (t.bandsPerSheet - 1)).toFixed(1)}mm across the sheet.`,
      fix: 'If the nudge is large, measure the sheet and fix the template pitch instead.',
    });
  }

  return checks;
}
