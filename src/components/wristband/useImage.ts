import { useEffect, useState } from 'react';
import { toast } from 'sonner';

/**
 * Loads an HTMLImageElement for a Konva <Image> node. CORS-enabled
 * (`crossOrigin='anonymous'`) so the resulting canvas stays exportable —
 * mirrors renderBand.ts's loadImages(). Fails loudly via toast; no
 * placeholder image is swapped in on error (per the no-silent-fallback rule).
 */
export function useImage(url: string | undefined): HTMLImageElement | undefined {
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

  return image;
}
