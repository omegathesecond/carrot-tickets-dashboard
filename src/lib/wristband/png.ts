import type { CalibrationOffset, SheetTemplate } from './templates';
import { bandRectsMm, mmToPrintPx, PRINT_DPI } from './layout';

/** Canvas PNGs otherwise carry 96 DPI, which prints a 600-DPI sheet too large. */
export function withPrintResolution(png: Uint8Array): Uint8Array {
  const pixelsPerMetre = Math.round(PRINT_DPI / 0.0254);
  const chunk = new Uint8Array(21);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, 9);
  chunk.set([112, 72, 89, 115], 4); // pHYs
  view.setUint32(8, pixelsPerMetre);
  view.setUint32(12, pixelsPerMetre);
  chunk[16] = 1; // units are metres
  let crc = 0xffffffff;
  for (const byte of chunk.subarray(4, 17)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  view.setUint32(17, (crc ^ 0xffffffff) >>> 0);

  // Keep every original chunk except its old resolution; insert after IHDR.
  const data = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const chunks: Uint8Array[] = [png.subarray(0, 8)];
  for (let pos = 8; pos < png.length;) {
    const end = pos + data.getUint32(pos) + 12;
    if (end > png.length) throw new Error('Invalid PNG chunk');
    const type = String.fromCharCode(...png.subarray(pos + 4, pos + 8));
    if (type !== 'pHYs') chunks.push(png.subarray(pos, end));
    if (type === 'IHDR') chunks.push(chunk);
    pos = end;
  }
  const output = new Uint8Array(chunks.reduce((n, part) => n + part.length, 0));
  let pos = 0;
  for (const part of chunks) { output.set(part, pos); pos += part.length; }
  return output;
}

/** One PNG per full sheet, using the same geometry and artwork as the PDF. */
export async function buildWristbandPngs(opts: {
  template: SheetTemplate;
  offset: CalibrationOffset;
  pages: Uint8Array[][];
}): Promise<Uint8Array[]> {
  const { template, offset, pages } = opts;
  const rects = bandRectsMm(template, offset);
  const pxPerMm = PRINT_DPI / 25.4;
  const canvas = document.createElement('canvas');
  canvas.width = mmToPrintPx(template.pageWidthMm);
  canvas.height = mmToPrintPx(template.pageHeightMm);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create the PNG sheet canvas');
  const output: Uint8Array[] = [];
  try {
    for (const bands of pages) {
      if (bands.length > template.bandsPerSheet) throw new Error('Page exceeds bandsPerSheet');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (const [i, bytes] of bands.entries()) {
        const image = await createImageBitmap(new Blob([bytes as BlobPart], { type: 'image/png' }));
        try {
          const r = rects[i];
          const width = r.widthMm * pxPerMm;
          const height = r.heightMm * pxPerMm;
          ctx.save();
          ctx.translate(r.xMm * pxPerMm, r.topMm * pxPerMm);
          if (offset.flip180) { ctx.translate(width, height); ctx.rotate(Math.PI); }
          ctx.drawImage(image, 0, 0, width, height);
          ctx.restore();
        } finally { image.close(); }
      }
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
        (value) => value ? resolve(value) : reject(new Error('Failed to encode PNG sheet')),
        'image/png',
      ));
      output.push(withPrintResolution(new Uint8Array(await blob.arrayBuffer())));
    }
    return output;
  } finally {
    canvas.width = canvas.height = 0;
  }
}
