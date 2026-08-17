/**
 * Cashless money helpers (ZAR cents on the wire). The dashboard's cashless
 * surfaces move money in integer cents; the catalogue price field is entered in
 * rand and converted here so the API only ever sees integer cents.
 */

/** Format integer cents as `R1,234.50`. */
export function fmtR(cents: number): string {
  return `R${((cents ?? 0) / 100).toLocaleString('en-ZA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Parse a rand string (e.g. "25", "25.5", "1,250.00") to integer cents.
 * Returns null for blank/invalid input so callers can block a bad submit
 * rather than sending a fabricated 0 (fail loud, no silent default).
 */
export function randToCents(input: string): number | null {
  const cleaned = input.replace(/[,\s]/g, '').trim();
  if (cleaned === '') return null;
  const rand = Number(cleaned);
  if (!Number.isFinite(rand) || rand < 0) return null;
  return Math.round(rand * 100);
}

/** Integer cents -> a plain rand string for pre-filling an edit form, e.g. "25.00". */
export function centsToRand(cents: number): string {
  return (cents / 100).toFixed(2);
}
