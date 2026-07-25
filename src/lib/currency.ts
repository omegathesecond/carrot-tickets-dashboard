// Display currency for event prices. 'SZL' (Lilangeni) shows 'E'; 'ZAR' (Rand)
// shows 'R'. Only used as a DISPLAY label for external events — Carrot never
// charges in anything but Emalangeni.
export type Currency = 'SZL' | 'ZAR';

export function currencySymbol(currency?: Currency | string): 'E' | 'R' {
  return currency === 'ZAR' ? 'R' : 'E';
}
