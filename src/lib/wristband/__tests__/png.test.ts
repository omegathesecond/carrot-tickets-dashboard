import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildWristbandPngs, withPrintResolution } from '../png';
import { DEFAULT_TEMPLATES, ZERO_CALIBRATION } from '../templates';
import { PRINT_DPI } from '../layout';

const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), c => c.charCodeAt(0));
const STOCK = DEFAULT_TEMPLATES.find(t => t.key === 'tyvek-10up-19mm-250x190')!;

afterEach(() => vi.unstubAllGlobals());

describe('print PNG resolution', () => {
  it('sets 600 DPI with a valid CRC and replaces existing resolution without altering artwork', () => {
    const output = withPrintResolution(PNG);
    expect(output.slice(0, 33)).toEqual(PNG.slice(0, 33)); // signature + IHDR
    expect(output.slice(54)).toEqual(PNG.slice(33)); // original image chunks
    const view = new DataView(output.buffer);
    expect(view.getUint32(33)).toBe(9);
    expect(String.fromCharCode(...output.slice(37, 41))).toBe('pHYs');
    expect(view.getUint32(41)).toBe(23622);
    expect(view.getUint32(45)).toBe(23622);
    expect(output[49]).toBe(1);
    // Independently calculated using Python zlib.crc32.
    expect(view.getUint32(50)).toBe(0x14944341);
    expect(withPrintResolution(output)).toEqual(output);
  });
});

function canvasFixture() {
  const ctx = {
    fillStyle: '', fillRect: vi.fn(), save: vi.fn(), restore: vi.fn(),
    translate: vi.fn(), rotate: vi.fn(), drawImage: vi.fn(),
  };
  const sizes: number[][] = [];
  const canvas = {
    width: 0, height: 0, getContext: () => ctx,
    toBlob(callback: (blob: Blob | null) => void) {
      sizes.push([this.width, this.height]);
      callback(new Blob([PNG]));
    },
  };
  const close = vi.fn();
  vi.stubGlobal('document', { createElement: () => canvas });
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ close }));
  return { canvas, ctx, sizes, close };
}

describe('PNG sheet layout', () => {
  it('uses 250×190 mm at 600 DPI and preserves partial pages, calibration, and measured pitch', async () => {
    const { canvas, ctx, sizes, close } = canvasFixture();
    const result = await buildWristbandPngs({
      template: STOCK, offset: { ...ZERO_CALIBRATION, dxMm: 1, dyMm: 2, dPitchMm: 0.25 },
      pages: [[PNG, PNG], [PNG]],
    });
    expect(sizes).toEqual([[5906, 4488], [5906, 4488]]);
    expect(result).toHaveLength(2);
    const scale = PRINT_DPI / 25.4;
    expect(ctx.translate).toHaveBeenNthCalledWith(1, scale, 2 * scale);
    expect(ctx.translate).toHaveBeenNthCalledWith(2, scale, (2 + 19.25) * scale);
    expect(ctx.drawImage).toHaveBeenCalledTimes(3);
    expect(close).toHaveBeenCalledTimes(3);
    expect(ctx.rotate).not.toHaveBeenCalled();
    expect(canvas.width).toBe(0);
  });

  it('rotates artwork and positions band 1 at the bottom for flipped stock', async () => {
    const { ctx } = canvasFixture();
    await buildWristbandPngs({ template: STOCK, offset: { ...ZERO_CALIBRATION, flip180: true }, pages: [[PNG]] });
    const scale = PRINT_DPI / 25.4;
    expect(ctx.translate).toHaveBeenNthCalledWith(1, 0, 171 * scale);
    expect(ctx.translate).toHaveBeenNthCalledWith(2, 250 * scale, 19 * scale);
    expect(ctx.rotate).toHaveBeenCalledWith(Math.PI);
  });

  it('fails loudly if encoding fails, and releases the sheet canvas', async () => {
    const { canvas } = canvasFixture();
    canvas.toBlob = callback => callback(null);
    await expect(buildWristbandPngs({ template: STOCK, offset: ZERO_CALIBRATION, pages: [[PNG]] })).rejects.toThrow('Failed to encode PNG sheet');
    expect(canvas.width).toBe(0);
  });
});
