/**
 * The crop shape each upload surface uses. These deliberately MIRROR what the
 * app already renders — they are not an instruction to change any layout. See
 * docs/superpowers/specs/2026-08-07-image-cropping-on-upload-design.md.
 *
 * `aspect` is width/height. `outputWidth` is the encoded width in pixels;
 * height is derived as round(outputWidth / aspect).
 */
export const CROP_PRESETS = {
  /** Buyer avatar — rendered rounded-full. */
  avatar: { aspect: 1, outputWidth: 512 },
  /** Brand logo — rendered rounded-full. */
  brandLogo: { aspect: 1, outputWidth: 512 },
  /** Story — full-screen StoryViewer. */
  story: { aspect: 9 / 16, outputWidth: 1080 },
  /** Discover post — full-screen vertical feed. */
  discoverPost: { aspect: 9 / 16, outputWidth: 1080 },
  /** Event poster — aspect-[2/3] masonry poster. */
  eventPoster: { aspect: 2 / 3, outputWidth: 1200 },
  /** Event photo — aspect-square grids (EventMediaTab, GalleryManager). */
  eventPhoto: { aspect: 1, outputWidth: 1600 },
  /** Event thumbnail — aspect-video card image on EventsPage. */
  eventThumbnail: { aspect: 16 / 9, outputWidth: 1280 },
  /** Brand update — aspect-square UpdatesGrid on the public profile. */
  brandUpdate: { aspect: 1, outputWidth: 1080 },
} as const;

export type CropPresetKey = keyof typeof CROP_PRESETS;

/** Output pixel dimensions for a preset. */
export function outputSizeFor(key: CropPresetKey): { width: number; height: number } {
  const { aspect, outputWidth } = CROP_PRESETS[key];
  return { width: outputWidth, height: Math.round(outputWidth / aspect) };
}
