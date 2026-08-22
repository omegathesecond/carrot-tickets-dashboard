/**
 * Colour maths for printing wristbands without black ink.
 *
 * Two things on a band are not plain fills: the QR code, which has to stay
 * machine-readable, and raster artwork, whose pixels carry their own colour.
 * Both need more than a colour picker to recolour safely.
 */

/** WCAG relative luminance of an #rrggbb colour, 0 (black) to 1 (white). */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio between two colours, 1 (identical) to 21 (black/white). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * A scanner reads a QR by luminance, not hue, so "dark blue on white" scans
 * and "yellow on white" does not — however different the two look to a person.
 *
 * 3:1 is the floor below which scanning fails outright; 7:1 is where it stops
 * depending on the phone, the light and the angle. Wristbands are scanned once
 * at a gate, at night, by whoever is on the door, so marginal is not good
 * enough to ship silently.
 */
export const QR_MIN_CONTRAST = 3;
export const QR_GOOD_CONTRAST = 7;

export type QrScanLevel = 'ok' | 'marginal' | 'unscannable';

export interface QrScanVerdict {
  ratio: number;
  level: QrScanLevel;
  /** Present for anything but 'ok'. Written for the person choosing the colour. */
  message?: string;
}

/**
 * Whether a QR in these two colours will actually scan.
 *
 * Polarity is checked separately from contrast: a light code on a dark
 * background can have superb contrast and still defeat scanners that only
 * look for dark-on-light.
 */
export function qrScanVerdict(dark: string, light: string): QrScanVerdict {
  const ratio = contrastRatio(dark, light);

  if (relativeLuminance(dark) >= relativeLuminance(light)) {
    return {
      ratio,
      level: 'unscannable',
      message:
        'The code colour is lighter than its background. Most scanners only read dark codes on a light background — swap the two.',
    };
  }
  if (ratio < QR_MIN_CONTRAST) {
    return {
      ratio,
      level: 'unscannable',
      message: `Only ${ratio.toFixed(1)}:1 contrast against the background — this will not scan. Pick a darker code colour (needs at least ${QR_MIN_CONTRAST}:1).`,
    };
  }
  if (ratio < QR_GOOD_CONTRAST) {
    return {
      ratio,
      level: 'marginal',
      message: `${ratio.toFixed(1)}:1 contrast is readable but thin for a gate at night. A darker colour (${QR_GOOD_CONTRAST}:1 or more) scans first time far more often.`,
    };
  }
  return { ratio, level: 'ok' };
}

/**
 * Ink coverage of one source pixel, 0 (leave the paper bare) to 1 (full ink).
 *
 * Recolouring artwork treats the image as INK rather than as colour: how dark
 * a pixel is becomes how much of the new colour to lay down. Black goes to
 * full ink, white drops out to nothing, and greys land in between, which keeps
 * antialiased edges smooth instead of jagged.
 *
 * Gamma-encoded luma on purpose, not the linear luminance above: it matches
 * how dark a pixel LOOKS, so a mid-grey logo comes out as a mid-strength tint
 * rather than the much lighter one linear light would give.
 */
export function inkCoverage(r: number, g: number, b: number, alpha: number): number {
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return (alpha / 255) * (1 - luma);
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`Not a hex colour: ${hex}`);
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}
