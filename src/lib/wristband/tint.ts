import { inkCoverage } from './ink';
import type { ImageElement } from './design';

/**
 * Recolouring raster artwork. Konva takes a <canvas> anywhere it takes an
 * <img>, so a recoloured copy drops straight into the editor, the sheet
 * preview and the 600 DPI print renderer with no other changes — which is
 * what keeps all three showing the same thing.
 */

/**
 * Identifies one loaded bitmap. Two elements sharing a URL but tinted
 * differently are different bitmaps, so the URL alone will not do as a key.
 */
export function imageKey(el: Pick<ImageElement, 'url' | 'tint'>): string {
  return `${el.url}|${el.tint ?? ''}`;
}

/**
 * The artwork redrawn in a single colour, using each pixel's darkness as ink
 * coverage (see inkCoverage). White backgrounds drop out instead of becoming
 * a solid block of the new colour, so a logo on white and the same logo on
 * transparency both come back as just the mark.
 */
export function inkImage(img: CanvasImageSource, tint: string, w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not get a 2D context to recolour artwork');

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = frame.data;
  const { r, g, b } = hexToRgb(tint);

  for (let i = 0; i < px.length; i += 4) {
    const coverage = inkCoverage(px[i], px[i + 1], px[i + 2], px[i + 3]);
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
    px[i + 3] = Math.round(coverage * 255);
  }
  ctx.putImageData(frame, 0, 0);
  return canvas;
}

/** Original bitmap when untinted, a recoloured canvas when not. */
export function inkedSource(
  img: HTMLImageElement, tint: string | null | undefined
): HTMLImageElement | HTMLCanvasElement {
  if (!tint) return img;
  return inkImage(img, tint, img.naturalWidth, img.naturalHeight);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`Not a hex colour: ${hex}`);
  return {
    r: parseInt(m[1].slice(0, 2), 16),
    g: parseInt(m[1].slice(2, 4), 16),
    b: parseInt(m[1].slice(4, 6), 16),
  };
}
