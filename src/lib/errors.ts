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
