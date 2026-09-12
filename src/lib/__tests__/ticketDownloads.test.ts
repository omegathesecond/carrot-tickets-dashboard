import { describe, it, expect, vi } from 'vitest';
import { buildTicketsZip, chunkTicketIds, downloadTicketBundles, MAX_BUNDLE_TICKETS } from '@/lib/ticketDownloads';

describe('buildTicketsZip', () => {
  it('includes one entry per ticket', async () => {
    const fetchOne = vi.fn(async (id: string) => new Blob([`pdf-${id}`], { type: 'application/pdf' }));
    const zip = await buildTicketsZip(['TKT-1', 'TKT-2'], fetchOne);
    expect(zip.size).toBeGreaterThan(0);
    expect(fetchOne).toHaveBeenCalledTimes(2);
  });

  // A ZIP quietly holding 4 of 5 tickets means someone finds out at the gate.
  it('fails the whole zip when any ticket fails', async () => {
    const fetchOne = vi.fn(async (id: string) => {
      if (id === 'TKT-2') throw new Error('403');
      return new Blob(['pdf'], { type: 'application/pdf' });
    });
    await expect(buildTicketsZip(['TKT-1', 'TKT-2'], fetchOne)).rejects.toThrow(/TKT-2/);
  });
});

describe('chunkTicketIds', () => {
  it('never emits a batch above the API bundle cap', () => {
    const ids = Array.from({ length: 250 }, (_, i) => `TKT-${i}`);
    const batches = chunkTicketIds(ids);
    expect(batches.map((b) => b.length)).toEqual([100, 100, 50]);
    expect(batches.flat()).toEqual(ids);
  });

  it('leaves an ordinary sale as one batch', () => {
    expect(chunkTicketIds(['TKT-1', 'TKT-2'])).toEqual([['TKT-1', 'TKT-2']]);
  });
});

describe('downloadTicketBundles', () => {
  // Two 100-qty tiers is a reachable basket; posting all 201 ids in one call
  // 400s, which is how "Download all (PDF)" got offered for sales it could
  // never serve.
  it('splits an over-cap sale instead of posting one doomed request', async () => {
    const ids = Array.from({ length: 201 }, (_, i) => `TKT-${i}`);
    const fetchBundle = vi.fn(async (_ids: string[]) => new Blob(['pdf'], { type: 'application/pdf' }));
    const saved: string[] = [];

    await downloadTicketBundles(ids, fetchBundle, (_blob, filename) => { saved.push(filename); });

    expect(fetchBundle).toHaveBeenCalledTimes(3);
    for (const call of fetchBundle.mock.calls) {
      expect(call[0].length).toBeLessThanOrEqual(MAX_BUNDLE_TICKETS);
    }
    // Every ticket is accounted for, and each batch lands as its own file.
    expect(fetchBundle.mock.calls.flatMap((c) => c[0])).toEqual(ids);
    expect(saved).toEqual(['tickets-1-of-3.pdf', 'tickets-2-of-3.pdf', 'tickets-3-of-3.pdf']);
  });

  it('keeps the single-file name for a normal sale', async () => {
    const fetchBundle = vi.fn(async () => new Blob(['pdf']));
    const saved: string[] = [];
    await downloadTicketBundles(['TKT-1', 'TKT-2'], fetchBundle, (_b, f) => { saved.push(f); });
    expect(fetchBundle).toHaveBeenCalledTimes(1);
    expect(saved).toEqual(['tickets.pdf']);
  });

  // Fail loudly, naming the batch — not a silent partial set the organizer
  // believes is complete.
  it('throws naming the failing batch', async () => {
    const ids = Array.from({ length: 150 }, (_, i) => `TKT-${i}`);
    const fetchBundle = vi.fn(async (batch: string[]) => {
      if (batch[0] === 'TKT-100') throw new Error('500 from the bundler');
      return new Blob(['pdf']);
    });
    await expect(downloadTicketBundles(ids, fetchBundle, () => {}))
      .rejects.toThrow(/part 2 of 2.*500 from the bundler/);
  });
});
