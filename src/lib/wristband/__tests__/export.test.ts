import { beforeEach, describe, expect, it, vi } from 'vitest';
import JSZip from 'jszip';
import { savePrintExport } from '../export';
import { saveBlob } from '../../ticketDownloads';
import { openPdf } from '../pdf';

vi.mock('../../ticketDownloads', () => ({ saveBlob: vi.fn() }));
vi.mock('../pdf', () => ({ openPdf: vi.fn() }));
beforeEach(() => vi.clearAllMocks());

describe('print export download', () => {
  it('downloads one sheet as a PNG', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    await savePrintExport({ format: 'png', pages: [bytes] }, 'farmers-250x190mm-600dpi');
    const [blob, name] = vi.mocked(saveBlob).mock.calls[0];
    expect(name).toBe('farmers-250x190mm-600dpi.png');
    expect(blob.type).toBe('image/png');
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(bytes);
    expect(openPdf).not.toHaveBeenCalled();
  });

  it('downloads every sheet in order in a single ZIP', async () => {
    const pages = [new Uint8Array([1, 2]), new Uint8Array([3, 4])];
    await savePrintExport({ format: 'png', pages }, 'farmers');
    const [blob, name] = vi.mocked(saveBlob).mock.calls[0];
    expect(name).toBe('farmers.zip');
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    expect(Object.keys(zip.files)).toEqual(['farmers-sheet-1.png', 'farmers-sheet-2.png']);
    expect(await zip.file('farmers-sheet-1.png')!.async('uint8array')).toEqual(pages[0]);
    expect(await zip.file('farmers-sheet-2.png')!.async('uint8array')).toEqual(pages[1]);
  });

  it('opens the PDF with its existing print flow', async () => {
    const bytes = new Uint8Array([5, 6]);
    await savePrintExport({ format: 'pdf', bytes }, 'farmers');
    expect(openPdf).toHaveBeenCalledWith(bytes);
    expect(saveBlob).not.toHaveBeenCalled();
  });
});
