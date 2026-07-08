import { describe, expect, it } from 'vitest';
import {
  imageEffectiveDpi, LOW_DPI_THRESHOLD, createImageElement, createTextElement,
  createQrElement, FONT_FAMILIES, hasVisibleQrElement,
} from '../design';

describe('imageEffectiveDpi', () => {
  it('computes DPI from natural pixels over printed mm', () => {
    // 3000px printed across 254mm (10") = 300 DPI exactly.
    const el = createImageElement('https://cdn/x.png', 3000, 300, 25.4);
    el.width = 254; el.height = 25.4;
    expect(imageEffectiveDpi(el)).toBeCloseTo(300, 3);
  });
  it('flags low-res artwork via the 300 DPI threshold', () => {
    const el = createImageElement('https://cdn/x.png', 800, 80, 25.4);
    el.width = 254; el.height = 25.4;
    expect(imageEffectiveDpi(el)).toBeLessThan(LOW_DPI_THRESHOLD);
  });
});

describe('factories', () => {
  it('createImageElement fits the band height, preserving aspect', () => {
    const el = createImageElement('u', 2000, 500, 25.4);
    expect(el.height).toBeCloseTo(25.4, 6);
    expect(el.width).toBeCloseTo(25.4 * 4, 6);
  });
  it('elements get unique ids and defaults', () => {
    const a = createTextElement();
    const b = createTextElement();
    expect(a.id).not.toBe(b.id);
    expect(a.visible).toBe(true);
    expect(a.locked).toBe(false);
    expect(FONT_FAMILIES).toContain(a.fontFamily);
  });
  it('qr element is square by construction', () => {
    const q = createQrElement();
    expect(q.type).toBe('qr');
    expect(q.sizeMm).toBeGreaterThan(0);
  });
});

describe('hasVisibleQrElement', () => {
  it('true when a visible qr element is present', () => {
    const elements = [createTextElement(), createQrElement()];
    expect(hasVisibleQrElement(elements)).toBe(true);
  });
  it('false when there is no qr element at all', () => {
    const elements = [createTextElement()];
    expect(hasVisibleQrElement(elements)).toBe(false);
  });
  it('false when the qr element is toggled invisible', () => {
    const elements = [createQrElement({ visible: false })];
    expect(hasVisibleQrElement(elements)).toBe(false);
  });
});
