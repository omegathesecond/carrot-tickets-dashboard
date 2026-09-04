/**
 * Client-side image prep shared by every upload surface: read a picked file,
 * decode it, and draw a user-chosen crop rect into a downscaled JPEG before
 * upload. Keeps encoded images small (a few tens/hundreds of KB) so the API
 * just stores the bytes — no server-side image processing needed.
 */

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read the selected image'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('That file does not look like an image'));
    img.src = src;
  });
}

export type CropRect = { x: number; y: number; width: number; height: number };

/**
 * Draw `rect` (in source-image pixels) from `file` into an `out`-sized JPEG.
 * Returns a File — not a bare Blob — so callers that read `.name` (e.g.
 * CreateEventModal's preview keys) keep working, and every Blob-typed upload
 * helper still accepts it.
 *
 * Throws with a user-facing message rather than falling back to the original
 * file: a silent fallback would upload an uncropped image while the UI
 * claimed the crop succeeded (CLAUDE.md).
 */
export async function cropResize(
  file: File,
  rect: CropRect,
  out: { width: number; height: number },
  quality = 0.9,
): Promise<File> {
  const dataUrl = await readAsDataURL(file);
  const img = await loadImage(dataUrl);
  if (!img.naturalWidth || !img.naturalHeight) throw new Error('That image appears to be empty');

  const canvas = document.createElement('canvas');
  canvas.width = out.width;
  canvas.height = out.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process the image on this device');
  ctx.drawImage(img, rect.x, rect.y, rect.width, rect.height, 0, 0, out.width, out.height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality),
  );
  if (!blob) throw new Error('Could not process the image');

  const base = file.name.replace(/\.[^./\\]+$/, '') || 'image';
  return new File([blob], `${base}.jpg`, { type: 'image/jpeg' });
}
