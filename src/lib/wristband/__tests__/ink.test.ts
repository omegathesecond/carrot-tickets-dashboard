import { describe, expect, it } from 'vitest';
import {
  contrastRatio, relativeLuminance, qrScanVerdict, inkCoverage,
  QR_MIN_CONTRAST,
} from '../ink';

describe('relativeLuminance', () => {
  it('anchors at black and white', () => {
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 6);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 6);
  });
  it('accepts shorthand hex', () => {
    expect(relativeLuminance('#fff')).toBeCloseTo(relativeLuminance('#ffffff'), 9);
  });
  it('rejects anything that is not a colour rather than guessing', () => {
    expect(() => relativeLuminance('blue')).toThrow(/Not a hex colour/);
  });
});

describe('contrastRatio', () => {
  it('spans 1:1 to 21:1', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrastRatio('#336699', '#336699')).toBeCloseTo(1, 6);
  });
  it('is symmetric', () => {
    expect(contrastRatio('#123456', '#ffffff')).toBeCloseTo(contrastRatio('#ffffff', '#123456'), 9);
  });
});

describe('qrScanVerdict', () => {
  it('passes a dark blue, which is the whole point of printing without black', () => {
    const v = qrScanVerdict('#00008b', '#ffffff');
    expect(v.level).toBe('ok');
    expect(v.message).toBeUndefined();
  });

  it('rejects colours that look bold but read as light to a scanner', () => {
    // Cyan and yellow are vivid to the eye and nearly white to a sensor.
    for (const c of ['#00ffff', '#ffff00']) {
      const v = qrScanVerdict(c, '#ffffff');
      expect(v.level).toBe('unscannable');
      expect(v.ratio).toBeLessThan(QR_MIN_CONTRAST);
    }
  });

  it('rejects an inverted code even when contrast is excellent', () => {
    const v = qrScanVerdict('#ffffff', '#000000');
    expect(v.ratio).toBeCloseTo(21, 1); // contrast is perfect...
    expect(v.level).toBe('unscannable'); // ...and it still will not scan
    expect(v.message).toMatch(/lighter than its background/);
  });

  it('flags readable-but-thin contrast instead of passing it silently', () => {
    const v = qrScanVerdict('#767676', '#ffffff');
    expect(v.level).toBe('marginal');
    expect(v.message).toMatch(/gate at night/);
  });

  it('names the shortfall in the units the picker shows', () => {
    const v = qrScanVerdict('#cccccc', '#ffffff');
    expect(v.message).toContain(`${QR_MIN_CONTRAST}:1`);
  });
});

describe('inkCoverage', () => {
  it('lays full ink for black and none for white', () => {
    expect(inkCoverage(0, 0, 0, 255)).toBeCloseTo(1, 6);
    expect(inkCoverage(255, 255, 255, 255)).toBeCloseTo(0, 6);
  });

  it('drops a white background out rather than tinting it solid', () => {
    // The reason recolouring is coverage-based: a logo on white must not come
    // back as a solid blue rectangle.
    expect(inkCoverage(255, 255, 255, 255)).toBe(0);
  });

  it('keeps transparent pixels transparent', () => {
    expect(inkCoverage(0, 0, 0, 0)).toBe(0);
  });

  it('gives antialiased greys partial coverage, so edges stay smooth', () => {
    const mid = inkCoverage(128, 128, 128, 255);
    expect(mid).toBeGreaterThan(0.4);
    expect(mid).toBeLessThan(0.6);
  });

  it('scales coverage by the source alpha', () => {
    expect(inkCoverage(0, 0, 0, 128)).toBeCloseTo(128 / 255, 6);
  });
});
