import { useEffect, useMemo, useState } from 'react';
import { inkedSource } from '@/lib/wristband/tint';
import { toast } from 'sonner';

/**
 * Loads artwork for a Konva <Image> node, recoloured when the element asks
 * for it. CORS-enabled (`crossOrigin='anonymous'`) so the resulting canvas
 * stays exportable — mirrors renderBand.ts's loadImages(), which applies the
 * same inkedSource() so screen and paper cannot drift apart. Fails loudly via
 * toast; no placeholder image is swapped in on error (per the
 * no-silent-fallback rule).
 */
export function useImage(
  url: string | undefined, tint?: string | null
): HTMLImageElement | HTMLCanvasElement | undefined {
  const [image, setImage] = useState<HTMLImageElement | undefined>(undefined);

  useEffect(() => {
    if (!url) {
      setImage(undefined);
      return;
    }
    let cancelled = false;
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!cancelled) setImage(img);
    };
    img.onerror = () => {
      if (!cancelled) {
        toast.error(`Failed to load artwork image: ${url}`);
      }
    };
    img.src = url;

    return () => {
      cancelled = true;
    };
  }, [url]);

  // Recolour off the loaded bitmap, not inside the loader, so changing the
  // colour re-inks instantly instead of re-fetching from R2.
  return useMemo(() => (image ? inkedSource(image, tint) : undefined), [image, tint]);
}
