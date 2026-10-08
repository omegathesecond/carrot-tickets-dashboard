import JSZip from 'jszip';
import { saveBlob } from '../ticketDownloads';
import { openPdf } from './pdf';
import type { PrintExport } from './printJob';

export async function savePrintExport(result: PrintExport, filename: string): Promise<void> {
  if (result.format === 'pdf') {
    openPdf(result.bytes);
  } else if (result.pages.length === 1) {
    saveBlob(new Blob([result.pages[0] as BlobPart], { type: 'image/png' }), `${filename}.png`);
  } else {
    const zip = new JSZip();
    result.pages.forEach((bytes, i) => zip.file(`${filename}-sheet-${i + 1}.png`, bytes));
    saveBlob(await zip.generateAsync({ type: 'blob' }), `${filename}.zip`);
  }
}
