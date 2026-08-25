// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cropResize } from '@/lib/image';

// jsdom decodes no images and implements no canvas. Stand both up so the
// pure geometry logic in cropResize is what's actually under test.
let drawImageArgs: unknown[] = [];
let toBlobResult: Blob | null = new Blob(['x'], { type: 'image/jpeg' });
let naturalSize = { width: 1000, height: 500 };

beforeEach(() => {
  drawImageArgs = [];
  toBlobResult = new Blob(['x'], { type: 'image/jpeg' });
  naturalSize = { width: 1000, height: 500 };

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: (...args: unknown[]) => { drawImageArgs = args; },
  } as unknown as CanvasRenderingContext2D);

  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
    function (this: HTMLCanvasElement, cb: BlobCallback) { cb(toBlobResult); },
  );

  // FileReader in jsdom works, but Image never fires onload. Force it.
  vi.stubGlobal('Image', class {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    naturalWidth = 0;
    naturalHeight = 0;
    set src(_v: string) {
      this.naturalWidth = naturalSize.width;
      this.naturalHeight = naturalSize.height;
      queueMicrotask(() => this.onload?.());
    }
  });
});

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function fakeFile(name = 'photo.png', type = 'image/png') {
  return new File(['bytes'], name, { type });
}

describe('cropResize', () => {
  it('draws the requested source rect into the requested output size', async () => {
    await cropResize(fakeFile(), { x: 100, y: 20, width: 400, height: 400 }, { width: 512, height: 512 });
    expect(drawImageArgs.slice(1)).toEqual([100, 20, 400, 400, 0, 0, 512, 512]);
  });

  it('returns a File named after the original with a .jpg extension', async () => {
    const out = await cropResize(fakeFile('My Photo.png'), { x: 0, y: 0, width: 10, height: 10 }, { width: 10, height: 10 });
    expect(out).toBeInstanceOf(File);
    expect(out.name).toBe('My Photo.jpg');
    expect(out.type).toBe('image/jpeg');
  });

  it('throws instead of returning the original when the canvas yields nothing', async () => {
    toBlobResult = null;
    await expect(
      cropResize(fakeFile(), { x: 0, y: 0, width: 10, height: 10 }, { width: 10, height: 10 }),
    ).rejects.toThrow(/could not process/i);
  });

  it('throws when the image has no dimensions', async () => {
    naturalSize = { width: 0, height: 0 };
    await expect(
      cropResize(fakeFile(), { x: 0, y: 0, width: 10, height: 10 }, { width: 10, height: 10 }),
    ).rejects.toThrow(/empty/i);
  });
});
