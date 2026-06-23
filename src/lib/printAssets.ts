// Fetch the Carrot Tickets icon once and cache it as a data URL, so the printed
// receipt embeds the logo inline and never depends on a network fetch at print
// time (the till may be offline at a venue).
//
// The logo is DECORATIVE: if it can't be loaded we return null and the receipt
// is built without it. The vital parts — QR codes and ticket codes — are
// generated separately and are unaffected, so this is an allowed best-effort
// omission, not a silent fallback that fakes data.
let cached: string | null | undefined;

export async function getPrintLogoDataUrl(): Promise<string | null> {
  if (cached !== undefined) return cached;
  try {
    const res = await fetch('/carrot_tickets_icon.png');
    if (!res.ok) {
      cached = null;
      return cached;
    }
    const blob = await res.blob();
    cached = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('logo read failed'));
      reader.readAsDataURL(blob);
    });
    return cached;
  } catch {
    cached = null;
    return cached;
  }
}
