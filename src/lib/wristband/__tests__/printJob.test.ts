import { beforeEach, describe, expect, it, vi } from 'vitest';
import { planPages, runPrintJob } from '../printJob';
import { loadImages, renderBandPng } from '../renderBand';
import { buildWristbandPdf } from '../pdf';
import { buildWristbandPngs } from '../png';
import { DEFAULT_TEMPLATES, ZERO_CALIBRATION } from '../templates';

vi.mock('../renderBand', () => ({ loadImages: vi.fn(), renderBandPng: vi.fn() }));
vi.mock('../pdf', () => ({ buildWristbandPdf: vi.fn() }));
vi.mock('../png', () => ({ buildWristbandPngs: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loadImages).mockResolvedValue(new Map());
  vi.mocked(renderBandPng).mockResolvedValue(new Uint8Array([1, 2, 3]));
  vi.mocked(buildWristbandPdf).mockResolvedValue(new Uint8Array([4, 5]));
  vi.mocked(buildWristbandPngs).mockResolvedValue([new Uint8Array([6, 7])]);
});

describe('planPages', () => {
  it('no-QR mode: N full sheets of nulls', () => {
    const pages = planPages(null, 3, 10);
    expect(pages).toHaveLength(3);
    expect(pages[0]).toHaveLength(10);
    expect(pages[0].every((x) => x === null)).toBe(true);
  });
  it('QR mode: chunks ticketIds, last page partial', () => {
    const ids = Array.from({ length: 23 }, (_, i) => `TKT-${i}`);
    const pages = planPages(ids, 0 /* ignored in QR mode */, 10);
    expect(pages).toHaveLength(3);
    expect(pages[2]).toHaveLength(3);
    expect(pages[0][0]).toBe('TKT-0');
    expect(pages[2][2]).toBe('TKT-22');
  });
  it('rejects empty work', () => {
    expect(() => planPages(null, 0, 10)).toThrow();
    expect(() => planPages([], 0, 10)).toThrow();
  });
});

describe('shared print rendering', () => {
  const options = { template: DEFAULT_TEMPLATES[0], offset: ZERO_CALIBRATION, background: '#ffffff', elements: [] };

  it('renders an identical no-QR design once for every sheet, then assembles PNGs', async () => {
    const progress = vi.fn();
    const result = await runPrintJob({ ...options, format: 'png', pages: [[null, null], [null]], onProgress: progress });
    expect(renderBandPng).toHaveBeenCalledTimes(1);
    expect(buildWristbandPngs).toHaveBeenCalledWith({
      template: options.template, offset: options.offset,
      pages: [[new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3])], [new Uint8Array([1, 2, 3])]],
    });
    expect(buildWristbandPdf).not.toHaveBeenCalled();
    expect(result).toEqual({ format: 'png', pages: [new Uint8Array([6, 7])] });
    expect(progress).toHaveBeenLastCalledWith(3, 3);
  });

  it('keeps each real ticket QR in order when exporting PDF', async () => {
    await runPrintJob({ ...options, format: 'pdf', pages: [['ABC', 'DEF']] });
    expect(vi.mocked(renderBandPng).mock.calls.map(([arg]) => arg.qr?.ticketId)).toEqual(['ABC', 'DEF']);
    expect(buildWristbandPdf).toHaveBeenCalledTimes(1);
    expect(buildWristbandPngs).not.toHaveBeenCalled();
  });

  it('does not download a partial result when an artwork dependency fails', async () => {
    vi.mocked(loadImages).mockRejectedValueOnce(new Error('Artwork failed to load'));
    await expect(runPrintJob({ ...options, format: 'png', pages: [[null]] })).rejects.toThrow('Artwork failed to load');
    expect(buildWristbandPngs).not.toHaveBeenCalled();
  });
});
