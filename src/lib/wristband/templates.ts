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
}

export interface CalibrationOffset {
  dxMm: number;
  dyMm: number;
}

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
  },
  {
    key: 'tyvek-10up-25mm-11x11', name: '11″×11″ sheet · 10-up · 1" bands',
    pageWidthMm: 279.4, pageHeightMm: 279.4, bandWidthMm: 254, bandHeightMm: 25.4,
    marginTopMm: 12.7, marginLeftMm: 12.7, gapYMm: 0, bandsPerSheet: 10, tabZoneMm: 20,
  },
  {
    key: 'letterl-10up-19mm', name: 'Letter landscape · 10-up · ¾" bands',
    pageWidthMm: 279.4, pageHeightMm: 215.9, bandWidthMm: 254, bandHeightMm: 19.05,
    marginTopMm: 12.7, marginLeftMm: 12.7, gapYMm: 1, bandsPerSheet: 10, tabZoneMm: 20,
  },
  {
    key: 'tyvek-10up-25mm-11x105', name: '11″×10.5″ sheet · 10-up · 1" bands',
    pageWidthMm: 279.4, pageHeightMm: 266.7, bandWidthMm: 254, bandHeightMm: 25.4,
    marginTopMm: 6.35, marginLeftMm: 12.7, gapYMm: 0, bandsPerSheet: 10, tabZoneMm: 20,
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
  const all = readJson<Record<string, CalibrationOffset>>(CAL_KEY, {});
  return all[templateKey] ?? { dxMm: 0, dyMm: 0 };
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
