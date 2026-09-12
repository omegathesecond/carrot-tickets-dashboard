import { describe, it, expect, vi } from 'vitest';
import { buildTicketsZip } from '@/lib/ticketDownloads';

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
