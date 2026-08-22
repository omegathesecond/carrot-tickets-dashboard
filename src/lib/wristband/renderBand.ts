import Konva from 'konva';
import QRCode from 'qrcode';
import type { SheetTemplate } from './templates';
import {
  qrDarkColor, QR_LIGHT_COLOR,
  type WristbandElement, type TextElement, type ImageElement,
  type ShapeElement, type QrElement,
} from './design';
import { imageKey, inkedSource } from './tint';
import { PRINT_DPI, mmToPrintPx } from './layout';

/**
 * Offscreen band renderer — the single source of truth for how design
 * elements map to pixels. The editor canvas reuses elementNodeAttrs() so what
 * you see at zoom is exactly what prints at 600 DPI.
 */

/** mm-space element → Konva node attrs at a given px-per-mm scale. */
export function elementNodeAttrs(el: WristbandElement, pxPerMm: number): Record<string, unknown> {
  const base = {
    id: el.id,
    x: el.x * pxPerMm,
    y: el.y * pxPerMm,
    rotation: el.rotation,
    opacity: el.opacity,
    visible: el.visible,
  };
  switch (el.type) {
    case 'text': {
      const t = el as TextElement;
      return {
        ...base, text: t.text, fontFamily: t.fontFamily, fontSize: t.fontSizeMm * pxPerMm,
        fill: t.fill, fontStyle: t.fontStyle, align: t.align, width: t.width * pxPerMm,
      };
    }
    case 'image': {
      const i = el as ImageElement;
      return { ...base, width: i.width * pxPerMm, height: i.height * pxPerMm };
    }
    case 'shape': {
      const sh = el as ShapeElement;
      return {
        ...base, width: sh.width * pxPerMm, height: sh.height * pxPerMm,
        fill: sh.fill || undefined, stroke: sh.stroke || undefined,
        strokeWidth: sh.strokeWidthMm * pxPerMm, cornerRadius: sh.cornerRadiusMm * pxPerMm,
      };
    }
    case 'qr': {
      const q = el as QrElement;
      return { ...base, width: q.sizeMm * pxPerMm, height: q.sizeMm * pxPerMm };
    }
  }
}

/**
 * Load all artwork; reject listing every URL that failed.
 *
 * Keyed by imageKey(), not URL: the same logo tinted two ways is two bitmaps.
 * Recolouring happens once here rather than per band, because a sheet redraws
 * the same artwork ten times.
 */
export async function loadImages(
  elements: WristbandElement[]
): Promise<Map<string, HTMLImageElement | HTMLCanvasElement>> {
  const imageEls = elements.filter((e): e is ImageElement => e.type === 'image');
  const byKey = new Map<string, ImageElement>();
  for (const el of imageEls) byKey.set(imageKey(el), el);
  const urls = [...new Set(imageEls.map((e) => e.url))];
  const failed: string[] = [];
  const entries = await Promise.all(urls.map(async (url) => {
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const im = new Image();
        im.crossOrigin = 'anonymous'; // R2 CDN must serve CORS; tainted canvases cannot export
        im.onload = () => resolve(im);
        im.onerror = () => reject(new Error(url));
        im.src = url;
      });
      return [url, img] as const;
    } catch {
      failed.push(url);
      return null;
    }
  }));
  if (failed.length) {
    throw new Error(`Failed to load artwork image(s): ${failed.join(', ')}`);
  }
  const loaded = new Map(entries.filter(Boolean) as (readonly [string, HTMLImageElement])[]);

  const out = new Map<string, HTMLImageElement | HTMLCanvasElement>();
  for (const [key, el] of byKey) {
    const img = loaded.get(el.url);
    if (!img) throw new Error(`Artwork not loaded: ${el.url}`);
    out.set(key, inkedSource(img, el.tint));
  }
  return out;
}

async function qrCanvas(text: string, sizePx: number, dark: string): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  await QRCode.toCanvas(canvas, text, {
    width: sizePx, margin: 0, errorCorrectionLevel: 'M',
    color: { dark, light: QR_LIGHT_COLOR },
  });
  return canvas;
}

export async function renderBandPng(opts: {
  template: SheetTemplate;
  background: string;
  elements: WristbandElement[];
  images: Map<string, HTMLImageElement | HTMLCanvasElement>;
  qr?: { ticketId: string };
}): Promise<Uint8Array> {
  const { template, background, elements, images, qr } = opts;
  if (qr && !elements.some((e) => e.type === 'qr' && e.visible)) {
    throw new Error('Design has no visible QR element to carry the ticket code');
  }
  const widthPx = mmToPrintPx(template.bandWidthMm);
  const heightPx = mmToPrintPx(template.bandHeightMm);
  const pxPerMm = PRINT_DPI / 25.4;

  const container = document.createElement('div');
  const stage = new Konva.Stage({ container, width: widthPx, height: heightPx });
  const layer = new Konva.Layer();
  stage.add(layer);

  try {
    layer.add(new Konva.Rect({ x: 0, y: 0, width: widthPx, height: heightPx, fill: background }));

    for (const el of elements) {
      if (!el.visible) continue;
      const attrs = elementNodeAttrs(el, pxPerMm);
      if (el.type === 'text') {
        layer.add(new Konva.Text(attrs as Konva.TextConfig));
      } else if (el.type === 'image') {
        const img = images.get(imageKey(el as ImageElement));
        if (!img) throw new Error(`Artwork not loaded: ${(el as ImageElement).url}`);
        layer.add(new Konva.Image({ ...(attrs as Konva.ImageConfig), image: img }));
      } else if (el.type === 'shape') {
        const sh = el as ShapeElement;
        if (sh.shape === 'rect') layer.add(new Konva.Rect(attrs as Konva.RectConfig));
        else if (sh.shape === 'ellipse') {
          const a = attrs as Konva.EllipseConfig & { width: number; height: number };
          layer.add(new Konva.Ellipse({
            ...a, x: (a.x as number) + a.width / 2, y: (a.y as number) + a.height / 2,
            radiusX: a.width / 2, radiusY: a.height / 2,
          }));
        } else {
          const a = attrs as { x: number; y: number; width: number } & Konva.LineConfig;
          layer.add(new Konva.Line({
            ...a, points: [0, 0, a.width, 0],
            stroke: (sh.stroke || sh.fill) || '#000000',
            strokeWidth: Math.max(1, sh.strokeWidthMm * pxPerMm),
          }));
        }
      } else if (el.type === 'qr' && qr) {
        const q = el as QrElement;
        const ink = qrDarkColor(q);
        const sizePx = Math.round(q.sizeMm * pxPerMm);
        const canvas = await qrCanvas(qr.ticketId, sizePx, ink);
        layer.add(new Konva.Image({
          image: canvas, x: q.x * pxPerMm, y: q.y * pxPerMm,
          width: sizePx, height: sizePx, rotation: q.rotation, opacity: q.opacity,
        }));
        // Human-readable code under the QR — gate staff fallback if a scan fails.
        layer.add(new Konva.Text({
          text: qr.ticketId, x: (q.x - q.sizeMm) * pxPerMm, y: (q.y + q.sizeMm + 0.8) * pxPerMm,
          width: 3 * q.sizeMm * pxPerMm, align: 'center',
          // Follows the QR's ink: on a press with no black cartridge, a
          // hardcoded near-black here would be the one thing that fails to print.
          fontFamily: 'Courier New', fontSize: 2.2 * pxPerMm, fill: ink,
        }));
      }
      // qr without opts.qr: placeholder intentionally not rendered (no-QR mode).
    }

    layer.draw();
    const dataUrl = stage.toDataURL({ mimeType: 'image/png', pixelRatio: 1 });
    const base64 = dataUrl.split(',')[1];
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  } finally {
    stage.destroy();
  }
}
