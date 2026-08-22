import { describe, expect, it } from 'vitest';
import { sheetChecks, sheetMeasurements } from '../sheetChecks';
import { DEFAULT_TEMPLATES, ZERO_CALIBRATION, type SheetTemplate } from '../templates';

const STOCK = DEFAULT_TEMPLATES.find((t) => t.key === 'tyvek-10up-19mm-250x190')!;
const WRONG = DEFAULT_TEMPLATES.find((t) => t.key === 'tyvek-10up-25mm-10x10')!;
const errors = (t: SheetTemplate, o = ZERO_CALIBRATION) =>
  sheetChecks(t, o).filter((c) => c.level === 'error');

describe('sheetMeasurements', () => {
  it('reports the ruler-checkable span across the whole sheet', () => {
    const m = sheetMeasurements(STOCK, ZERO_CALIBRATION);
    expect(m.pitchMm).toBe(19);
    expect(m.spanMm).toBe(171); // band 1 top -> band 10 top = 9 pitches
    expect(m.bottomSlackMm).toBe(0);
    expect(m.printableWidthMm).toBe(220); // 250 band - 30 tab
  });

  it('folds the calibration pitch nudge into the reported span', () => {
    const m = sheetMeasurements(STOCK, { ...ZERO_CALIBRATION, dxMm: 0, dyMm: 0, dPitchMm: 0.1 });
    expect(m.pitchMm).toBeCloseTo(19.1, 9);
    expect(m.spanMm).toBeCloseTo(171.9, 6);
  });
});

describe('sheetChecks', () => {
  it('passes the measured stock with no errors', () => {
    expect(errors(STOCK)).toEqual([]);
  });

  it('flags a band taller than its spacing as overlapping the next die-cut', () => {
    const bad: SheetTemplate = { ...STOCK, bandHeightMm: 25.4, pitchMm: 19 };
    expect(errors(bad).some((c) => /overlaps the next die-cut/.test(c.message))).toBe(true);
  });

  it('flags bands running off the bottom, and names the pitch that would fit', () => {
    // The real bug: 1" spacing on a 190mm sheet overruns by 57.6mm.
    const bad: SheetTemplate = { ...STOCK, pitchMm: 25.4 };
    const overrun = errors(bad).find((c) => /past the bottom/.test(c.message));
    expect(overrun?.message).toContain('57.6mm');
    expect(overrun?.fix).toContain('19.00mm'); // 19mm bands DO fit; only spacing is wrong
  });

  it('blames band height, not spacing, when the bands cannot fit at any pitch', () => {
    // 10 x 25.4mm needs 254mm of a 190mm sheet: no pitch rescues this, so the
    // fix must not send them round the loop to an overlap error.
    const bad: SheetTemplate = { ...STOCK, bandHeightMm: 25.4, pitchMm: 25.4 };
    const overrun = errors(bad).find((c) => /past the bottom/.test(c.message));
    expect(overrun?.fix).toContain('254mm even with no gaps');
    expect(overrun?.fix).not.toMatch(/Set spacing to/);
  });

  it('flags bands running off the right edge', () => {
    const bad: SheetTemplate = { ...STOCK, bandWidthMm: 260 };
    expect(errors(bad).some((c) => /past the right edge/.test(c.message))).toBe(true);
  });

  it('flags a tab zone that swallows the whole band', () => {
    const bad: SheetTemplate = { ...STOCK, tabZoneMm: 250 };
    expect(errors(bad).some((c) => /nothing is printable/.test(c.message))).toBe(true);
  });

  it('bails out on non-positive spacing rather than reporting nonsense', () => {
    const checks = sheetChecks(STOCK, { ...ZERO_CALIBRATION, dxMm: 0, dyMm: 0, dPitchMm: -19 });
    expect(checks).toHaveLength(1);
    expect(checks[0].message).toContain('on top of each other');
  });

  it('warns that full-bleed stock reaches past what most printers can reach', () => {
    const warn = sheetChecks(STOCK, ZERO_CALIBRATION).find((c) => c.level === 'warning');
    expect(warn?.message).toMatch(/top, left, right, bottom/); // 250mm band on a 250mm sheet: all four
    expect(warn?.fix).toContain('borderless');
  });

  it('warns when a pitch nudge is doing the template’s job', () => {
    const warn = sheetChecks(STOCK, { ...ZERO_CALIBRATION, dxMm: 0, dyMm: 0, dPitchMm: 0.5 })
      .find((c) => /stretching spacing/.test(c.message));
    expect(warn?.message).toContain('4.5mm across the sheet');
  });

  it('catches the wrong-stock template the moment its page size is corrected', () => {
    // Same 1" template, told the truth about the paper it is being fed.
    const onRealPaper: SheetTemplate = { ...WRONG, pageWidthMm: 250, pageHeightMm: 190 };
    const found = errors(onRealPaper);
    expect(found.some((c) => /past the bottom/.test(c.message))).toBe(true);
    expect(found.some((c) => /past the right edge/.test(c.message))).toBe(true);
  });
});

describe('flipped sheets report positive distances', () => {
  const flipped = { ...ZERO_CALIBRATION, flip180: true };

  it('never reports a negative span just because band 1 moved to the bottom', () => {
    // The calibration page prints this number for the user to measure against
    // a ruler. "-171.0mm" is not a distance anyone can check.
    const m = sheetMeasurements(STOCK, flipped);
    expect(m.spanMm).toBeGreaterThan(0);
    expect(m.spanMm).toBe(sheetMeasurements(STOCK, ZERO_CALIBRATION).spanMm);
  });

  it('gives a flipped full-bleed sheet the same clean bill of health', () => {
    expect(errors(STOCK, flipped)).toEqual([]);
    expect(sheetChecks(STOCK, flipped).map((c) => c.message))
      .toEqual(sheetChecks(STOCK, ZERO_CALIBRATION).map((c) => c.message));
  });
});
