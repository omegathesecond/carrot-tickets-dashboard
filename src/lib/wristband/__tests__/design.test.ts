import { describe, expect, it } from 'vitest';
import {
  imageEffectiveDpi, LOW_DPI_THRESHOLD, createImageElement, createTextElement,
  createQrElement, FONT_FAMILIES, hasVisibleQrElement, copyDesignToEvent,
  unscannableQrElement, qrDarkColor,
  type WristbandDesignDoc, type QrElement,
} from '../design';
import { DEFAULT_TEMPLATES } from '../templates';

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

describe('copyDesignToEvent', () => {
  const makeSource = (): WristbandDesignDoc => ({
    _id: 'src-123',
    eventId: 'event-A',
    name: 'Gold VIP band',
    sheetTemplate: DEFAULT_TEMPLATES[0],
    designJson: {
      background: '#ffffff',
      elements: [createImageElement('https://cdn.carrottickets.com/x.png', 1000, 250, 25.4)],
    },
  });

  it('clears _id so Save creates a new design instead of overwriting the source', () => {
    expect(copyDesignToEvent(makeSource(), 'event-B')._id).toBeUndefined();
  });

  it('retargets eventId to the destination event', () => {
    expect(copyDesignToEvent(makeSource(), 'event-B').eventId).toBe('event-B');
  });

  it('preserves name, sheetTemplate and designJson including artwork URLs', () => {
    const source = makeSource();
    const copy = copyDesignToEvent(source, 'event-B');
    expect(copy.name).toBe('Gold VIP band');
    expect(copy.sheetTemplate).toEqual(source.sheetTemplate);
    expect(copy.designJson).toEqual(source.designJson);
    expect((copy.designJson.elements[0] as { url: string }).url)
      .toBe('https://cdn.carrottickets.com/x.png');
  });

  it('does not mutate the source design', () => {
    const source = makeSource();
    const snapshot = JSON.parse(JSON.stringify(source));
    copyDesignToEvent(source, 'event-B');
    expect(source).toEqual(snapshot);
  });
});

describe('unscannableQrElement', () => {
  const qr = (over: Partial<QrElement> = {}) => createQrElement(over);

  it('passes a design with no QR at all — nothing to be unscannable', () => {
    expect(unscannableQrElement([createTextElement()])).toBeNull();
  });

  it('treats a QR with no colour as black, the way it always printed', () => {
    expect(qrDarkColor(qr())).toBe('#000000');
    expect(unscannableQrElement([qr()])).toBeNull();
  });

  it('passes a dark blue code — printing without black ink is the point', () => {
    expect(unscannableQrElement([qr({ darkColor: '#00008b' })])).toBeNull();
  });

  it('catches a code too light to scan, and says why', () => {
    const found = unscannableQrElement([qr({ darkColor: '#ffff00' })]);
    expect(found).not.toBeNull();
    expect(found!.message).toMatch(/will not scan/);
  });

  it('ignores hidden QR elements — they never reach paper', () => {
    expect(unscannableQrElement([qr({ darkColor: '#ffff00', visible: false })])).toBeNull();
  });

  it('reports the first bad code when a design has several', () => {
    const found = unscannableQrElement([
      qr({ darkColor: '#00008b' }), qr({ darkColor: '#eeeeee' }),
    ]);
    expect(found!.el.darkColor).toBe('#eeeeee');
  });
});
