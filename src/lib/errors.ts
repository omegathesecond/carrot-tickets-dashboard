// Markers that an error message is raw technical noise we must NEVER surface in
// the UI: HTML (e.g. a WAF "Request Rejected" block page that leaked through),
// upstream status codes, or payment-provider support IDs.
const TECHNICAL_PATTERNS = [
  /<\s*\/?\s*[a-z!][^>]*>/i, // any HTML tag / <!DOCTYPE
  /request rejected/i,
  /support id/i,
  /\bHTTP\s*\d{3}\b/i,
  /requesttopay|momoapi|proxy\.momoapi/i,
];

/**
 * Isolate ugly errors at the UI boundary. Returns the original message ONLY when
 * it is a clean, human-readable sentence; otherwise returns `fallback`. The real,
 * elaborated error still lives in the backend logs — this is purely display
 * hygiene so staff/buyers never see HTML or a WAF support ID in a toast.
 */
export function friendlyMessage(error: unknown, fallback: string): string {
  const raw =
    typeof error === 'string' ? error :
    error instanceof Error ? error.message :
    (error && typeof (error as any).message === 'string') ? (error as any).message :
    '';

  const msg = (raw || '').trim();
  if (!msg) return fallback;
  if (msg.length > 160) return fallback;
  if (TECHNICAL_PATTERNS.some((re) => re.test(msg))) return fallback;
  return msg;
}

/**
 * Map MTN MoMo's failure reason enum (sent on a failed status) to a clear,
 * staff-friendly sentence for the reseller POS. Most real-world MoMo failures
 * are an under-funded buyer wallet (NOT_ENOUGH_FUNDS). Case-insensitive +
 * substring so enum spelling drift still resolves.
 */
export function momoFailureMessage(reason?: string): string {
  const r = (reason || '').toUpperCase();
  const has = (...keys: string[]) => keys.some((k) => r.includes(k));

  if (has('NOT_ENOUGH_FUNDS', 'INSUFFICIENT', 'LOW_BALANCE', 'BALANCE'))
    return 'The buyer’s MoMo wallet doesn’t have enough balance. Ask them to top up, then try again.';
  if (has('PAYER_NOT_FOUND', 'PAYEE_NOT_FOUND', 'NOT_FOUND'))
    return 'That number isn’t registered for MTN MoMo. Use a number with an active MoMo wallet.';
  if (has('EXPIRED', 'TIMEOUT'))
    return 'The payment request expired before it was approved. Please try again.';
  if (has('REJECT', 'NOT_APPROVED', 'CANCEL', 'DENIED'))
    return 'The buyer declined or cancelled the payment. Please try again.';
  if (has('LIMIT'))
    return 'This exceeds the buyer’s MoMo transaction limit. Try a smaller amount or another method.';
  if (has('AMOUNT_MISMATCH'))
    return 'We couldn’t confirm the payment amount, so nothing was charged. Please try again.';

  return 'The MoMo payment could not be completed. Please try again.';
}
