import { describe, expect, it } from 'vitest';
import {
  mmToPt, mmToPrintPx, bandRectsPt, bandRectsMm, bandTopsMm, pitchFromSpanMm,
  MM_TO_PT, PRINT_DPI,
} from '../layout';
import { sheetMeasurements } from '../sheetChecks';
import { DEFAULT_TEMPLATES, bandPitchMm, ZERO_CALIBRATION, type SheetTemplate } from '../templates';

const T = DEFAULT_TEMPLATES.find((t) => t.key === 'tyvek-10up-25mm-11x11')!;
const STOCK = DEFAULT_TEMPLATES.find((t) => t.key === 'tyvek-10up-19mm-250x190')!;

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
    const rects = bandRectsPt(T, ZERO_CALIBRATION);
    expect(rects).toHaveLength(10);
    for (const r of rects) {
      expect(r.widthPt).toBeCloseTo(mmToPt(T.bandWidthMm), 6);
      expect(r.heightPt).toBeCloseTo(mmToPt(T.bandHeightMm), 6);
      expect(r.xPt).toBeCloseTo(mmToPt(T.marginLeftMm), 6);
    }
    // Top band: its TOP edge sits marginTopMm below the page top, so its
    // bottom-left y = pageHeight - marginTop - bandHeight (in pt).
    expect(rects[0].yPt).toBeCloseTo(mmToPt(T.pageHeightMm - T.marginTopMm - T.bandHeightMm), 6);
    // Next band is one PITCH lower.
    expect(rects[0].yPt - rects[1].yPt).toBeCloseTo(mmToPt(bandPitchMm(T)), 6);
  });

  it('includes a nonzero gap in the band spacing', () => {
    const G = DEFAULT_TEMPLATES.find((t) => t.key === 'a4l-10up-19mm')!;
    expect(G.gapYMm).toBeGreaterThan(0); // guard: template must exercise the gap term
    const rects = bandRectsPt(G, ZERO_CALIBRATION);
    expect(rects[0].yPt - rects[1].yPt).toBeCloseTo(mmToPt(bandPitchMm(G)), 6);
  });

  it('applies calibration: +dx shifts right, +dy shifts DOWN the printed page', () => {
    const base = bandRectsPt(T, ZERO_CALIBRATION);
    const nudged = bandRectsPt(T, { ...ZERO_CALIBRATION, dxMm: 2, dyMm: 3, dPitchMm: 0 });
    expect(nudged[0].xPt - base[0].xPt).toBeCloseTo(mmToPt(2), 6);
    expect(base[0].yPt - nudged[0].yPt).toBeCloseTo(mmToPt(3), 6); // down = smaller PDF y
  });
});

describe('band pitch is independent of band height', () => {
  it('spaces bands by pitchMm, not bandHeightMm + gapYMm', () => {
    // A die that cuts 19mm bands every 22mm — the case the old model could
    // not express at all, because it forced pitch === height + gap.
    const t: SheetTemplate = { ...STOCK, bandHeightMm: 19, gapYMm: 0, pitchMm: 22 };
    const tops = bandTopsMm(t, ZERO_CALIBRATION);
    expect(tops[1] - tops[0]).toBeCloseTo(22, 9);
    expect(tops[9] - tops[0]).toBeCloseTo(9 * 22, 9);
    // Drawn band height stays 19 — pitch moved, the band did not grow.
    expect(bandRectsPt(t, ZERO_CALIBRATION)[0].heightPt).toBeCloseTo(mmToPt(19), 6);
  });

  it('falls back to bandHeightMm + gapYMm for templates saved before pitch existed', () => {
    const { pitchMm: _drop, ...legacy } = STOCK;
    expect(bandPitchMm(legacy)).toBe(legacy.bandHeightMm + legacy.gapYMm);
    // Identical geometry to the pre-pitch build: old saved designs are untouched.
    expect(bandTopsMm(legacy, ZERO_CALIBRATION)).toEqual(bandTopsMm(STOCK, ZERO_CALIBRATION));
  });
});

describe('the 250x190 Tyvek stock', () => {
  it('lays ten 19mm bands edge to edge across exactly 190mm', () => {
    expect(bandPitchMm(STOCK)).toBe(19);
    const tops = bandTopsMm(STOCK, ZERO_CALIBRATION);
    expect(tops[0]).toBe(0);
    expect(tops[9]).toBe(171);
    expect(tops[9] + STOCK.bandHeightMm).toBe(STOCK.pageHeightMm); // full bleed, no slack
  });

  it('REGRESSION: the 1" template drifts a full band by #4 and 45mm by #8', () => {
    const wrong = DEFAULT_TEMPLATES.find((t) => t.key === 'tyvek-10up-25mm-10x10')!;
    const wrongTops = bandTopsMm(wrong, ZERO_CALIBRATION);
    const realTops = bandTopsMm(STOCK, ZERO_CALIBRATION);
    const drift = (i: number) => wrongTops[i] - realTops[i];

    expect(drift(0)).toBe(0);                    // band 1 looks perfect...
    expect(drift(3)).toBeCloseTo(19.2, 6);       // ...band 4 is a whole band out
    expect(drift(7)).toBeCloseTo(44.8, 6);       // ...band 8 is unusable
    // The symptom that names the bug: error is strictly proportional to index.
    for (let i = 1; i < 10; i++) expect(drift(i)).toBeCloseTo(i * 6.4, 6);
  });
});

describe('pitch calibration', () => {
  it('dPitchMm corrects accumulated drift without moving band 1', () => {
    const tops = bandTopsMm(STOCK, { ...ZERO_CALIBRATION, dxMm: 0, dyMm: 0, dPitchMm: 0.2 });
    expect(tops[0]).toBe(0);                       // band 1 unmoved
    expect(tops[9] - tops[0]).toBeCloseTo(9 * 19.2, 6);
  });

  it('dyMm shifts every band rigidly, so it can never fix a spacing error', () => {
    const base = bandTopsMm(STOCK, ZERO_CALIBRATION);
    const shifted = bandTopsMm(STOCK, { ...ZERO_CALIBRATION, dxMm: 0, dyMm: 2, dPitchMm: 0 });
    for (let i = 0; i < base.length; i++) expect(shifted[i] - base[i]).toBeCloseTo(2, 9);
  });
});

describe('pitchFromSpanMm', () => {
  it('derives the stock pitch from a whole-sheet measurement', () => {
    expect(pitchFromSpanMm(171, 10)).toBe(19);
    expect(pitchFromSpanMm(228.6, 10)).toBeCloseTo(25.4, 9);
  });

  it('divides ruler error by bandsPerSheet - 1', () => {
    const exact = pitchFromSpanMm(171, 10);
    const halfMmOut = pitchFromSpanMm(171.5, 10);
    expect(halfMmOut - exact).toBeCloseTo(0.5 / 9, 9);
  });

  it('refuses a span that cannot define a pitch', () => {
    expect(() => pitchFromSpanMm(19, 1)).toThrow(/at least 2 bands/);
  });
});

describe('180-degree flip for stock that can only feed one way', () => {
  const flipped = { ...ZERO_CALIBRATION, flip180: true };

  it('mirrors band positions about the sheet centre', () => {
    const normal = bandRectsMm(STOCK, ZERO_CALIBRATION);
    const turned = bandRectsMm(STOCK, flipped);
    for (let i = 0; i < normal.length; i++) {
      // A rect and its flipped twin sit equidistant from opposite edges.
      expect(turned[i].topMm).toBeCloseTo(
        STOCK.pageHeightMm - normal[i].topMm - normal[i].heightMm, 9
      );
      expect(turned[i].xMm).toBeCloseTo(
        STOCK.pageWidthMm - normal[i].xMm - normal[i].widthMm, 9
      );
    }
  });

  it('sends band 1 to the bottom of the sheet and band 10 to the top', () => {
    const turned = bandRectsMm(STOCK, flipped);
    expect(turned[0].topMm).toBe(171); // band 1 comes out last
    expect(turned[9].topMm).toBe(0);
    // Still ten bands covering exactly the same ten slots, just reordered.
    expect([...turned.map((r) => r.topMm)].sort((a, b) => a - b))
      .toEqual(bandRectsMm(STOCK, ZERO_CALIBRATION).map((r) => r.topMm));
  });

  it('moves the adhesive tab to the other end of the band', () => {
    expect(bandRectsMm(STOCK, ZERO_CALIBRATION)[0].tabAtLeft).toBe(false);
    expect(bandRectsMm(STOCK, flipped)[0].tabAtLeft).toBe(true);
  });

  it('keeps dx/dy meaning what comes out of the printer, not what went in', () => {
    // Calibration is applied AFTER the flip: +dy is down on the finished
    // sheet whether or not the page was turned around. Applying it first
    // would invert both axes the moment someone ticked the box.
    const base = bandRectsMm(STOCK, flipped);
    const nudged = bandRectsMm(STOCK, { ...flipped, dxMm: 2, dyMm: 3 });
    for (let i = 0; i < base.length; i++) {
      expect(nudged[i].xMm - base[i].xMm).toBeCloseTo(2, 9);
      expect(nudged[i].topMm - base[i].topMm).toBeCloseTo(3, 9);
    }
  });

  it('is its own inverse — flipping a flip is the original layout', () => {
    const t = { ...STOCK, marginTopMm: 5, marginLeftMm: 7, pageHeightMm: 220, pageWidthMm: 270 };
    const once = bandRectsMm(t, flipped);
    const back = once.map((r) => ({
      xMm: t.pageWidthMm - r.xMm - r.widthMm,
      topMm: t.pageHeightMm - r.topMm - r.heightMm,
    }));
    const normal = bandRectsMm(t, ZERO_CALIBRATION);
    for (let i = 0; i < normal.length; i++) {
      expect(back[i].topMm).toBeCloseTo(normal[i].topMm, 9);
      expect(back[i].xMm).toBeCloseTo(normal[i].xMm, 9);
    }
  });

  it('reports a positive span and correct slack despite the reversed order', () => {
    // rects[last] - rects[0] would be -171 here; measuring by extremes must not.
    const m = sheetMeasurements(STOCK, flipped);
    expect(m.spanMm).toBe(171);
    expect(m.topSlackMm).toBe(0);
    expect(m.bottomSlackMm).toBe(0);
  });

  it('still catches an asymmetric template overflowing, on the flipped edge', () => {
    // Bands hang 10mm off the bottom normally; flipped, they hang off the TOP.
    const t = { ...STOCK, marginTopMm: 10 };
    expect(sheetMeasurements(t, ZERO_CALIBRATION).bottomSlackMm).toBeCloseTo(-10, 9);
    expect(sheetMeasurements(t, flipped).topSlackMm).toBeCloseTo(-10, 9);
  });
});
