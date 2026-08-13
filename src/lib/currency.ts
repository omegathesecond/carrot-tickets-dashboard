// Display currency for event prices. 'SZL' (Lilangeni) shows 'E'; 'ZAR' (Rand)
// shows 'R'. Only used as a DISPLAY label for external events — Carrot never
// charges in anything but Emalangeni.
export type Currency = 'SZL' | 'ZAR';

export function currencySymbol(currency?: Currency | string): 'E' | 'R' {
  return currency === 'ZAR' ? 'R' : 'E';
}

/**
 * Format a money amount with the currency's symbol. Default is tight ("R100")
 * to match inline price sites. `space` inserts a gap ("E 100") and `decimals`
 * forces fixed decimals with thousands separators (the chart/receipt style).
 */
export function formatMoney(
  amount: number,
  currency: Currency,
  opts: { space?: boolean; decimals?: number } = {}
): string {
  const sym = currencySymbol(currency);
  const gap = opts.space ? ' ' : '';
  const body = opts.decimals != null
    ? amount.toLocaleString('en-US', {
        minimumFractionDigits: opts.decimals,
        maximumFractionDigits: opts.decimals,
      })
    : String(amount);
  return `${sym}${gap}${body}`;
}

/** A min–max admission range; collapses to a single figure when equal. */
export function formatMoneyRange(min: number, max: number, currency: Currency): string {
  const lo = formatMoney(min, currency);
  return max > min ? `${lo}–${formatMoney(max, currency)}` : lo;
}
