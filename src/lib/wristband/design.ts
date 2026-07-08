import type { SheetTemplate } from './templates';

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
