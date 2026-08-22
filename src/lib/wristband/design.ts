import type { SheetTemplate } from './templates';
import { qrScanVerdict } from './ink';

/**
 * Wristband design scene model. All positions/sizes are MILLIMETRES relative
 * to the band's top-left corner — resolution-independent, so the same design
 * renders in the editor (screen px) and the print pipeline (600 DPI) from one
 * source of truth.
 */
export interface BaseElement {
  id: string;
  x: number;
  y: number;
  rotation: number;
  opacity: number;
  locked: boolean;
  visible: boolean;
}

export interface TextElement extends BaseElement {
  type: 'text';
  text: string;
  fontFamily: string;
  fontSizeMm: number;
  fill: string;
  fontStyle: 'normal' | 'bold' | 'italic' | 'bold italic';
  align: 'left' | 'center' | 'right';
  width: number;
}

export interface ImageElement extends BaseElement {
  type: 'image';
  url: string;
  width: number;
  height: number;
  naturalWidth: number;
  naturalHeight: number;
  /**
   * Reprint the artwork in this single colour instead of its own — for a
   * printer that has run out of one cartridge, or a one-colour band.
   *
   * Absent or null keeps the original artwork. Absent on designs saved before
   * recolouring existed, which is exactly what those designs meant.
   */
  tint?: string | null;
}

export interface ShapeElement extends BaseElement {
  type: 'shape';
  shape: 'rect' | 'ellipse' | 'line';
  width: number;
  height: number;
  fill: string;
  stroke: string;
  strokeWidthMm: number;
  cornerRadiusMm: number;
}

export interface QrElement extends BaseElement {
  type: 'qr';
  sizeMm: number;
  /**
   * Colour of the code's dark modules. Absent means black, which is what
   * every design saved before this was.
   *
   * Never set this without checking qrScanVerdict(): a scanner reads the code
   * by luminance, so a colour can look bold and still be invisible to it.
   */
  darkColor?: string;
}

/** The QR's light modules. A white quiet zone is what scanners expect. */
export const QR_LIGHT_COLOR = '#ffffff';

/** A QR's dark-module colour, defaulting to black for pre-colour designs. */
export function qrDarkColor(el: QrElement): string {
  return el.darkColor ?? '#000000';
}

export type WristbandElement = TextElement | ImageElement | ShapeElement | QrElement;

export interface WristbandDesignDoc {
  _id?: string;
  eventId: string;
  name: string;
  sheetTemplate: SheetTemplate;
  designJson: { background: string; elements: WristbandElement[] };
}

/**
 * Curated, deterministic font list. System-installed families — printing
 * happens from the office machine, so availability is stable there. No webfont
 * loading pipeline (YAGNI until a brand font is requested).
 */
export const FONT_FAMILIES = [
  'Arial', 'Arial Black', 'Helvetica', 'Verdana', 'Trebuchet MS',
  'Georgia', 'Times New Roman', 'Courier New', 'Impact',
];

/** Artwork below this effective print resolution gets a visible warning. */
export const LOW_DPI_THRESHOLD = 300;

/** Effective print DPI of an image at its current printed size (worst axis). */
export function imageEffectiveDpi(el: ImageElement): number {
  const dpiX = el.naturalWidth / (el.width / 25.4);
  const dpiY = el.naturalHeight / (el.height / 25.4);
  return Math.min(dpiX, dpiY);
}

export function newElementId(): string {
  return crypto.randomUUID();
}

const BASE = (): BaseElement => ({
  id: newElementId(), x: 5, y: 3, rotation: 0, opacity: 1, locked: false, visible: true,
});

export function createTextElement(partial: Partial<TextElement> = {}): TextElement {
  return {
    ...BASE(), type: 'text', text: 'Event Name', fontFamily: 'Arial',
    fontSizeMm: 8, fill: '#111111', fontStyle: 'bold', align: 'left', width: 80,
    ...partial,
  };
}

export function createShapeElement(partial: Partial<ShapeElement> = {}): ShapeElement {
  return {
    ...BASE(), type: 'shape', shape: 'rect', width: 30, height: 10,
    fill: '#ff6600', stroke: '', strokeWidthMm: 0, cornerRadiusMm: 0,
    ...partial,
  };
}

export function createQrElement(partial: Partial<QrElement> = {}): QrElement {
  return { ...BASE(), type: 'qr', sizeMm: 15, ...partial };
}

/** True when the design can carry a per-band QR — used to block QR print modes otherwise. */
export function hasVisibleQrElement(elements: WristbandElement[]): boolean {
  return elements.some((e) => e.type === 'qr' && e.visible);
}

/**
 * The first visible QR whose colours will not scan, if any. Printing mints
 * REAL tickets, so this runs before batch-issue — an unscannable wristband is
 * a ticket that cannot be used, not a cosmetic problem.
 */
export function unscannableQrElement(
  elements: WristbandElement[]
): { el: QrElement; message: string } | null {
  for (const e of elements) {
    if (e.type !== 'qr' || !e.visible) continue;
    const verdict = qrScanVerdict(qrDarkColor(e as QrElement), QR_LIGHT_COLOR);
    if (verdict.level === 'unscannable') {
      return { el: e as QrElement, message: verdict.message! };
    }
  }
  return null;
}

/** New image element scaled to fit the band height, aspect preserved. */
export function createImageElement(
  url: string, naturalWidth: number, naturalHeight: number, bandHeightMm: number
): ImageElement {
  const height = bandHeightMm;
  const width = (naturalWidth / naturalHeight) * height;
  return {
    ...BASE(), x: 0, y: 0, type: 'image', url, width, height, naturalWidth, naturalHeight,
  };
}

/**
 * Copy a saved design so it can be loaded into the editor as a NEW (unsaved)
 * design under a different event. Clearing `_id` is essential: it forces the
 * editor's Save down the create path, so the SOURCE event's design is never
 * overwritten by a PUT. `sheetTemplate` and `designJson` (background, elements
 * and their absolute artwork URLs) are carried over verbatim, so the copy is
 * fully self-contained and does not depend on the target event.
 */
export function copyDesignToEvent(
  source: WristbandDesignDoc,
  targetEventId: string,
): WristbandDesignDoc {
  return { ...source, _id: undefined, eventId: targetEventId };
}
