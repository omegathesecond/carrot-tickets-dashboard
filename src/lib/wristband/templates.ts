/**
 * Sheet templates for 10-up detachable Tyvek wristband sheets, plus the
 * per-printer calibration offsets. All dimensions are millimetres.
 *
 * The exact sheet brand is unknown (spec: template + calibration), so we ship
 * common 10-up layouts and let the user tune or define a custom template. The
 * chosen template is snapshotted into each saved design; calibration offsets
 * are printer+machine specific and live in localStorage only.
 */
export interface SheetTemplate {
  key: string;
  name: string;
  pageWidthMm: number;
  pageHeightMm: number;
  bandWidthMm: number;
  bandHeightMm: number;
  marginTopMm: number;
  marginLeftMm: number;
  gapYMm: number;
  bandsPerSheet: number;
  /** Width of the adhesive/tab keep-out zone at the band's RIGHT end. */
  tabZoneMm: number;
  /**
   * Die-cut to die-cut distance — the ONLY thing that controls where band i
   * lands. Measure it as (band 1 top -> band N top) / (N - 1); measuring
   * across the whole sheet divides your ruler error by N-1.
   *
   * Deliberately independent of bandHeightMm: a die can cut a 19mm band every
   * 20mm. Deriving pitch from band height is what made every band after the
   * first drift by i x (modelPitch - realPitch) with no way to correct it.
   *
   * Optional: templates snapshotted into designs before pitch was modelled
   * lack it, and bandPitchMm() falls back to what they always meant.
   */
  pitchMm?: number;
}

/** Band pitch in mm, with the pre-pitch fallback for old saved templates. */
export function bandPitchMm(t: SheetTemplate): number {
  return t.pitchMm ?? t.bandHeightMm + t.gapYMm;
}

/**
 * Most printers cannot reach the last few mm of any edge. Full-bleed
 * templates (margin 0, bands filling the page) put artwork inside that band,
 * so the preview shades it rather than letting the printer silently clip.
 */
export const TYPICAL_PRINTER_MARGIN_MM = 4;

export interface CalibrationOffset {
  dxMm: number;
  dyMm: number;
  /**
   * Per-band spacing correction, added to the template pitch. dx/dy translate
   * every band rigidly, so they can only ever fix band 1 — a spacing error
   * compounds down the sheet and needs its own knob.
   */
  dPitchMm: number;
  /**
   * Rotate the whole page 180 degrees, for stock the printer will only take
   * one way round — Tyvek whose adhesive edge cannot lead, for instance.
   * Loading the sheet turned around turns the print with it, so the page is
   * rotated to cancel that out.
   *
   * Per printer, not per sheet: the same stock in a machine with a different
   * paper path may not need it, which is why it lives with the calibration
   * rather than on the template.
   */
  flip180: boolean;
}

export const ZERO_CALIBRATION: CalibrationOffset = {
  dxMm: 0, dyMm: 0, dPitchMm: 0, flip180: false,
};

// Common 10-up sheets: bands are 10" (254mm) long, 3/4" (19.05mm) or 1"
// (25.4mm) tall. Only the 3/4" bands fit 10-up on A4 (210×297) or US Letter
// (215.9×279.4) carriers printed in LANDSCAPE — those page entries are the
// rotated (landscape) sizes so the 254mm band fits across the width. Ten 1"
// bands stack to 254mm, taller than any A4/Letter edge allows with margins,
// so 1" bands ride custom ~11" square-ish carriers (11″×11″, 11″×10.5″).
export const DEFAULT_TEMPLATES: SheetTemplate[] = [
  {
    key: 'a4l-10up-19mm', name: 'A4 landscape · 10-up · ¾" bands',
    pageWidthMm: 297, pageHeightMm: 210, bandWidthMm: 254, bandHeightMm: 19.05,
    marginTopMm: 9.75, marginLeftMm: 21.5, gapYMm: 1, bandsPerSheet: 10, tabZoneMm: 20,
    pitchMm: 20.05,
  },
  {
    key: 'tyvek-10up-25mm-11x11', name: '11″×11″ sheet · 10-up · 1" bands',
    pageWidthMm: 279.4, pageHeightMm: 279.4, bandWidthMm: 254, bandHeightMm: 25.4,
    marginTopMm: 12.7, marginLeftMm: 12.7, gapYMm: 0, bandsPerSheet: 10, tabZoneMm: 20,
    pitchMm: 25.4,
  },
  {
    key: 'letterl-10up-19mm', name: 'Letter landscape · 10-up · ¾" bands',
    pageWidthMm: 279.4, pageHeightMm: 215.9, bandWidthMm: 254, bandHeightMm: 19.05,
    marginTopMm: 12.7, marginLeftMm: 12.7, gapYMm: 1, bandsPerSheet: 10, tabZoneMm: 20,
    pitchMm: 20.05,
  },
  {
    key: 'tyvek-10up-25mm-11x105', name: '11″×10.5″ sheet · 10-up · 1" bands',
    pageWidthMm: 279.4, pageHeightMm: 266.7, bandWidthMm: 254, bandHeightMm: 25.4,
    marginTopMm: 6.35, marginLeftMm: 12.7, gapYMm: 0, bandsPerSheet: 10, tabZoneMm: 20,
    pitchMm: 25.4,
  },
  {
    // Measured from the office Tyvek stock (2026-07-08): 254×254mm sheet,
    // bands full-bleed edge to edge (10 × 25.4mm fills the height exactly,
    // no margins, no gaps), 30mm white adhesive/tab zone at the band end.
    // Full-bleed edges may need the printer's borderless mode.
    key: 'tyvek-10up-25mm-10x10', name: '10″×10″ sheet · 10-up · 1" bands · 30mm tab',
    pageWidthMm: 254, pageHeightMm: 254, bandWidthMm: 254, bandHeightMm: 25.4,
    marginTopMm: 0, marginLeftMm: 0, gapYMm: 0, bandsPerSheet: 10, tabZoneMm: 30,
    pitchMm: 25.4,
  },
  {
    // Measured from the Tyvek stock in hand (2026-08-22): 250×190mm sheet of
    // ten 19mm (¾") bands, full bleed — 10 × 19 fills the 190mm height exactly
    // — with a 30mm white adhesive/tab zone at the band end.
    //
    // This stock is what exposed the pitch bug: it was being printed with the
    // 10″×10″ 1"-band template above, whose 25.4mm pitch is 6.4mm too long per
    // band. Band 1 landed perfectly and the error compounded — 19mm (a full
    // band) out by band 4, 45mm out by band 8.
    key: 'tyvek-10up-19mm-250x190', name: '250×190mm sheet · 10-up · 19mm bands · 30mm tab',
    pageWidthMm: 250, pageHeightMm: 190, bandWidthMm: 250, bandHeightMm: 19,
    marginTopMm: 0, marginLeftMm: 0, gapYMm: 0, bandsPerSheet: 10, tabZoneMm: 30,
    pitchMm: 19,
  },
];

const CAL_KEY = 'carrot.wristband.calibration';
const CUSTOM_KEY = 'carrot.wristband.customTemplates';

function readJson<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadCalibration(templateKey: string): CalibrationOffset {
  const all = readJson<Record<string, Partial<CalibrationOffset>>>(CAL_KEY, {});
  const saved = all[templateKey];
  if (!saved) return { ...ZERO_CALIBRATION };
  return {
    dxMm: saved.dxMm ?? 0,
    dyMm: saved.dyMm ?? 0,
    dPitchMm: saved.dPitchMm ?? 0,
    flip180: saved.flip180 ?? false,
  };
}

export function saveCalibration(templateKey: string, offset: CalibrationOffset): void {
  const all = readJson<Record<string, CalibrationOffset>>(CAL_KEY, {});
  all[templateKey] = offset;
  localStorage.setItem(CAL_KEY, JSON.stringify(all));
}

export function loadCustomTemplates(): SheetTemplate[] {
  return readJson<SheetTemplate[]>(CUSTOM_KEY, []);
}

export function saveCustomTemplate(t: SheetTemplate): void {
  const rest = loadCustomTemplates().filter((x) => x.key !== t.key);
  localStorage.setItem(CUSTOM_KEY, JSON.stringify([...rest, t]));
}

export function deleteCustomTemplate(key: string): void {
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(loadCustomTemplates().filter((x) => x.key !== key)));
}

export function allTemplates(): SheetTemplate[] {
  return [...DEFAULT_TEMPLATES, ...loadCustomTemplates()];
}
