import { describe, expect, it } from 'vitest';
import { mmToPt, mmToPrintPx, bandRectsPt, MM_TO_PT, PRINT_DPI } from '../layout';
import { DEFAULT_TEMPLATES } from '../templates';

const T = DEFAULT_TEMPLATES.find((t) => t.key === 'tyvek-10up-25mm-11x11')!;

describe('unit conversions', () => {
  it('mmToPt: 25.4mm = 72pt', () => {
    expect(mmToPt(25.4)).toBeCloseTo(72, 6);
    expect(MM_TO_PT).toBeCloseTo(72 / 25.4, 9);
  });
  it('mmToPrintPx: 25.4mm at 600 DPI = 600px', () => {
    expect(PRINT_DPI).toBe(600);
    expect(mmToPrintPx(25.4)).toBe(600);
    expect(mmToPrintPx(254)).toBe(6000);
  });
});

describe('bandRectsPt', () => {
  it('produces one rect per band, top band first, in PDF bottom-left coords', () => {
    const rects = bandRectsPt(T, { dxMm: 0, dyMm: 0 });
    expect(rects).toHaveLength(10);
    for (const r of rects) {
      expect(r.widthPt).toBeCloseTo(mmToPt(T.bandWidthMm), 6);
      expect(r.heightPt).toBeCloseTo(mmToPt(T.bandHeightMm), 6);
      expect(r.xPt).toBeCloseTo(mmToPt(T.marginLeftMm), 6);
    }
    // Top band: its TOP edge sits marginTopMm below the page top, so its
    // bottom-left y = pageHeight - marginTop - bandHeight (in pt).
    expect(rects[0].yPt).toBeCloseTo(mmToPt(T.pageHeightMm - T.marginTopMm - T.bandHeightMm), 6);
    // Next band is one bandHeight+gap lower.
    expect(rects[0].yPt - rects[1].yPt).toBeCloseTo(mmToPt(T.bandHeightMm + T.gapYMm), 6);
  });

  it('applies calibration: +dx shifts right, +dy shifts DOWN the printed page', () => {
    const base = bandRectsPt(T, { dxMm: 0, dyMm: 0 });
    const nudged = bandRectsPt(T, { dxMm: 2, dyMm: 3 });
    expect(nudged[0].xPt - base[0].xPt).toBeCloseTo(mmToPt(2), 6);
    expect(base[0].yPt - nudged[0].yPt).toBeCloseTo(mmToPt(3), 6); // down = smaller PDF y
  });
});
