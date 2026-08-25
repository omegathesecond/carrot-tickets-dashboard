import { useCallback, useEffect, useState } from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import Cropper from 'react-easy-crop';
import { Loader2 } from 'lucide-react';
import { cropResize, type CropRect } from '@/lib/image';
import { CROP_PRESETS, outputSizeFor, type CropPresetKey } from '@/lib/cropPresets';

interface ImageCropperDialogProps {
  /** The picked file. Rendering starts as soon as this is non-null. */
  file: File;
  /** Which surface this is for — decides the locked aspect and output size. */
  preset: CropPresetKey;
  onCancel: () => void;
  onCropped: (file: File) => void;
}

/**
 * Locked-ratio crop step between a file input and its upload. Owns no upload
 * logic: it takes the picked File and hands back a cropped one.
 *
 * On failure it surfaces the message and stays open rather than passing the
 * original through — an uncropped upload presented as a successful crop is
 * exactly the silent fallback CLAUDE.md forbids.
 *
 * ## Why this renders as its own Radix `Dialog` rather than a bare portal
 *
 * Four of the eight call sites open this while a Radix modal `Dialog` is
 * already open underneath (UsernameEditor, CreateEventModal x2, and
 * EventQuickView -> EventMediaTab -> ComposerSheet -> CaptureScreen). Two
 * earlier attempts tried to live *beside* that dialog instead of *under* it,
 * and each one broke on a different containment model:
 *
 *  1. A plain `createPortal` to document.body was completely inert. Radix's
 *     modal content sets `document.body.style.pointerEvents = 'none'`, and
 *     `pointer-events` inherits — pan, zoom, Cancel and "Use photo" all ate
 *     nothing. That is *CSS/DOM* containment.
 *  2. Adding `pointer-events-auto` restored input but made things worse:
 *     Radix's `DismissableLayer` decides what counts as an "outside"
 *     interaction by *REACT-TREE* containment, not DOM containment. It flips
 *     `isPointerInsideReactTreeRef` from an `onPointerDownCapture` on its own
 *     layer element, so only React descendants of `DialogContent` register as
 *     "inside". A portal moves the DOM but not the React tree — and this
 *     dialog is a React *sibling* of `DialogContent`, never a descendant. So
 *     the very first `pointerdown` here read as an outside interaction and
 *     dismissed the parent: mouse-panning the poster closed CreateEventModal
 *     mid-drag and its `reset()` wiped the half-filled form.
 *
 * Rendering as a nested `Dialog.Root` fixes both because it makes this a real
 * child *layer* rather than a bystander. `DismissableLayerContext` has no
 * Provider — every layer in the app shares one module-level registry — so
 * mounting order alone establishes the nesting, regardless of React position:
 *
 *  - `pointer-events`: our layer is the highest with outside pointer events
 *    disabled, so Radix puts `pointerEvents: 'auto'` inline on it (and
 *    children inherit). No `pointer-events-auto` class needed.
 *  - dismissal: the parent layer's `isPointerEventsEnabled` goes false the
 *    moment we mount, so its `onPointerDownOutside` short-circuits before
 *    `onDismiss` — the parent cannot be dismissed by anything happening in
 *    here, on the pointer path OR the deferred touch `click` path.
 *  - Escape: `useEscapeKeydown` fires on every layer, but each one bails
 *    unless it is the highest, so Escape reaches this crop step and stops.
 *  - focus: `FocusScope` keeps a stack and pauses the parent scope when ours
 *    mounts. The parent's `handleFocusIn` uses *DOM* containment, so under a
 *    bare portal it yanked focus back out of here and the Zoom slider could
 *    not be operated by keyboard. Paused, it leaves us alone.
 *  - screen readers: our own `hideOthers()` runs after the parent's and keeps
 *    this subtree visible while hiding everything else, instead of us being
 *    the thing marked `aria-hidden`.
 *
 * `onInteractOutside` is prevented outright: this dialog is full-screen, so
 * there is no meaningful "outside" to click — only Escape and the two buttons
 * may end the crop.
 *
 * Gesture containment still matters, and is unchanged: React portals bubble
 * SYNTHETIC events through the REACT tree, not the DOM tree, so a click in
 * here still reaches whatever React ancestor mounted it.
 * BrandEditProfileSheet relies on that directly — it mounts this dialog
 * inside its own stopPropagation panel specifically so a click here doesn't
 * bubble to the backdrop's onClick={onClose}. `Dialog.Portal` uses the same
 * `createPortal` underneath, so that still holds.
 */
export function ImageCropperDialog({ file, preset, onCancel, onCropped }: ImageCropperDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<CropRect | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const onCropComplete = useCallback((_area: unknown, pixels: CropRect) => setArea(pixels), []);

  async function confirm() {
    if (!area) return;
    setError(null);
    setBusy(true);
    try {
      onCropped(await cropResize(file, area, outputSizeFor(preset)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not process the image');
    } finally {
      setBusy(false);
    }
  }

  return (
    <RadixDialog.Root
      open
      // The only routes to `false` are Escape and (prevented above) an
      // outside interaction. Mirrors the Cancel button: a no-op while a crop
      // is in flight, not merely visually disabled — an in-flight
      // cropResize() must not be raced by an unmount.
      onOpenChange={(next) => {
        if (!next && !busy) onCancel();
      }}
    >
      <RadixDialog.Portal>
        <RadixDialog.Content
          className="fixed inset-0 z-[200] flex flex-col bg-black focus:outline-none"
          aria-label="Crop photo"
          // No prose in here to describe it with; opting out silences Radix's
          // missing-Description warning rather than pointing at a dead id.
          aria-describedby={undefined}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <RadixDialog.Title className="sr-only">Crop photo</RadixDialog.Title>

          <div className="relative flex-1">
            {url && (
              <Cropper
                image={url}
                crop={crop}
                zoom={zoom}
                aspect={CROP_PRESETS[preset].aspect}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            )}
          </div>

          <div className="space-y-3 bg-white p-4">
            {error && <p className="text-sm text-red-600">{error}</p>}
            <label className="flex items-center gap-3">
              <span className="text-xs text-slate-500">Zoom</span>
              <input
                type="range" min={1} max={3} step={0.01} value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                aria-label="Zoom" className="w-full"
              />
            </label>
            <div className="flex gap-3">
              <button
                type="button" onClick={onCancel} disabled={busy}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-900"
              >
                Cancel
              </button>
              <button
                type="button" onClick={confirm} disabled={busy || !area}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Use photo
              </button>
            </div>
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
