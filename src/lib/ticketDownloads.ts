import JSZip from 'jszip';

/** Hand a generated file to the browser. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Zip one PDF per ticket.
 *
 * All-or-nothing on purpose: a zip silently containing 4 of 5 tickets means the
 * organizer hands out four and discovers the fifth at the gate. One failure
 * fails the download, naming the ticket that broke.
 */
export async function buildTicketsZip(
  ticketIds: string[],
  fetchOne: (ticketId: string) => Promise<Blob>,
): Promise<Blob> {
  const zip = new JSZip();
  for (const ticketId of ticketIds) {
    try {
      zip.file(`${ticketId}.pdf`, await fetchOne(ticketId));
    } catch (err) {
      throw new Error(`Could not fetch ${ticketId}: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  }
  return zip.generateAsync({ type: 'blob' });
}
