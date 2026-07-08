import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { buildWristbandPdf, buildCalibrationPdf } from '../pdf';
import { DEFAULT_TEMPLATES } from '../templates';
import { mmToPt } from '../layout';

const T = DEFAULT_TEMPLATES.find((t) => t.key === 'tyvek-10up-25mm-11x11')!;

// Tiny valid 1×1 PNG.
const PNG_1PX = Uint8Array.from(atob(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
), (c) => c.charCodeAt(0));

describe('buildWristbandPdf', () => {
  it('creates pages at the exact template size with one image per band', async () => {
    const bytes = await buildWristbandPdf({
      template: T, offset: { dxMm: 0, dyMm: 0 },
      pages: [Array(10).fill(PNG_1PX), Array(3).fill(PNG_1PX)],
    });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(2);
    const { width, height } = doc.getPage(0).getSize();
    expect(width).toBeCloseTo(mmToPt(T.pageWidthMm), 3);
    expect(height).toBeCloseTo(mmToPt(T.pageHeightMm), 3);
  });

  it('rejects a page with more bands than the template holds', async () => {
    await expect(buildWristbandPdf({
      template: T, offset: { dxMm: 0, dyMm: 0 }, pages: [Array(11).fill(PNG_1PX)],
    })).rejects.toThrow(/bandsPerSheet/);
  });
});

describe('buildCalibrationPdf', () => {
  it('produces a single page at template size', async () => {
    const bytes = await buildCalibrationPdf(T, { dxMm: 1, dyMm: 1 });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getPage(0).getSize().width).toBeCloseTo(mmToPt(T.pageWidthMm), 3);
  });
});
