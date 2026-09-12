import JSZip from 'jszip';

/**
 * How many ticket ids POST /tickets/pdf-bundle accepts in one call. It 400s
 * above this, and two 100-qty tiers is a perfectly ordinary box-office
 * basket — so "Download all (PDF)" must split, not fail.
 */
export const MAX_BUNDLE_TICKETS = 100;

/** Split ids into bundle-sized batches, preserving order. */
export function chunkTicketIds(ticketIds: string[], size = MAX_BUNDLE_TICKETS): string[][] {
  if (size < 1) throw new Error('chunk size must be at least 1');
  const out: string[][] = [];
  for (let i = 0; i < ticketIds.length; i += size) out.push(ticketIds.slice(i, i + size));
  return out;
}

/**
 * Download every ticket in a sale as PDF(s), splitting at the API's bundle
 * cap. One file for an ordinary sale; `tickets-1-of-3.pdf` … for a big one.
 *
 * All-or-nothing on the FETCHES, like buildTicketsZip: a failing batch throws
 * naming itself, rather than leaving the organizer with a partial set they
 * think is complete. Batches already saved stay saved — the throw says which
 * one failed so it can be retried.
 */
export async function downloadTicketBundles(
  ticketIds: string[],
  fetchBundle: (ids: string[]) => Promise<Blob>,
  save: (blob: Blob, filename: string) => void = saveBlob,
): Promise<void> {
  const batches = chunkTicketIds(ticketIds);
  for (const [i, ids] of batches.entries()) {
    let blob: Blob;
    try {
      blob = await fetchBundle(ids);
    } catch (err) {
      throw new Error(
        batches.length === 1
          ? (err instanceof Error ? err.message : 'Could not build the ticket PDF')
          : `Could not build part ${i + 1} of ${batches.length}: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
    }
    save(blob, batches.length === 1 ? 'tickets.pdf' : `tickets-${i + 1}-of-${batches.length}.pdf`);
  }
}

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
