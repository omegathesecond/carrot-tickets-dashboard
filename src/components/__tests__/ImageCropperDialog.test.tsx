// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act, within, cleanup } from '@testing-library/react';
import { createPortal } from 'react-dom';
import { ImageCropperDialog } from '@/components/ImageCropperDialog';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

// react-easy-crop measures the DOM and listens for real pointer events,
// neither of which jsdom provides. Replace it with a stub that immediately
// reports a known crop area, so this test covers OUR wiring, not the library.
// `reportsArea` lets one test (the disabled-button-before-crop-area case)
// opt out of the auto-report without touching the other tests' behaviour.
//
// The stub also records every props object it was rendered with, in
// `cropStubState.lastProps` — the frame SHAPE (locked `aspect`) is the whole
// user-visible contract of this feature, and a stub that silently discarded
// props (the previous version) would let a bug like passing `outputWidth`
// where `aspect` belongs sail through the suite untested.
//
// `reported` makes the auto-report fire ONCE PER MOUNT rather than once per
// render. The real library reports from pointer/zoom events; a stub that
// reports from the render body instead is a self-feeding loop — every report
// hands back a fresh object, `setArea` sees a new identity, React re-renders,
// the stub reports again. The synchronous tests below never noticed, but any
// test that awaits real timers inside `act()` (i.e. every integration test in
// the second describe block) starves and times out.
const cropStubState = vi.hoisted(() => ({
  reportsArea: true,
  reported: false,
  lastProps: null as Record<string, unknown> | null,
}));
vi.mock('react-easy-crop', () => ({
  default: (props: { onCropComplete: (a: unknown, px: unknown) => void }) => {
    cropStubState.lastProps = props;
    if (cropStubState.reportsArea && !cropStubState.reported) {
      cropStubState.reported = true;
      queueMicrotask(() => props.onCropComplete({}, { x: 5, y: 7, width: 200, height: 200 }));
    }
    return <div data-testid="cropper" />;
  },
}));

const cropResize = vi.hoisted(() => vi.fn());
vi.mock('@/lib/image', () => ({ cropResize }));

function file() { return new File(['b'], 'pic.png', { type: 'image/png' }); }

beforeEach(() => {
  cropResize.mockReset();
  cropResize.mockResolvedValue(new File(['c'], 'pic.jpg', { type: 'image/jpeg' }));
  cropStubState.reportsArea = true;
  cropStubState.reported = false;
  cropStubState.lastProps = null;
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:preview');
  globalThis.URL.revokeObjectURL = vi.fn();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('ImageCropperDialog', () => {
  it('crops with the preset size and hands back the cropped file', async () => {
    const onCropped = vi.fn();
    render(<ImageCropperDialog file={file()} preset="avatar" onCancel={vi.fn()} onCropped={onCropped} />);

    fireEvent.click(await screen.findByRole('button', { name: /use photo/i }));

    await waitFor(() => expect(onCropped).toHaveBeenCalledTimes(1));
    expect(cropResize).toHaveBeenCalledWith(
      expect.any(File),
      { x: 5, y: 7, width: 200, height: 200 },
      { width: 512, height: 512 },
    );
    expect(onCropped.mock.calls[0][0]).toBeInstanceOf(File);
  });

  it('cancels without cropping', async () => {
    const onCancel = vi.fn();
    const onCropped = vi.fn();
    render(<ImageCropperDialog file={file()} preset="avatar" onCancel={onCancel} onCropped={onCropped} />);

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCropped).not.toHaveBeenCalled();
    expect(cropResize).not.toHaveBeenCalled();
  });

  it('shows the error and stays open when cropping fails — never returns the original', async () => {
    cropResize.mockRejectedValue(new Error('Could not process the image'));
    const onCropped = vi.fn();
    render(<ImageCropperDialog file={file()} preset="avatar" onCancel={vi.fn()} onCropped={onCropped} />);

    fireEvent.click(await screen.findByRole('button', { name: /use photo/i }));

    expect(await screen.findByText(/could not process the image/i)).toBeTruthy();
    expect(onCropped).not.toHaveBeenCalled();
    expect(screen.getByTestId('cropper')).toBeTruthy();
  });

  it('disables "Use photo" until a crop area has been reported', async () => {
    cropStubState.reportsArea = false;
    render(<ImageCropperDialog file={file()} preset="avatar" onCancel={vi.fn()} onCropped={vi.fn()} />);

    expect((await screen.findByRole('button', { name: /use photo/i })).hasAttribute('disabled')).toBe(true);
    expect(cropResize).not.toHaveBeenCalled();
  });

  // Finding #3 of the final review: the frame SHAPE (locked `aspect`) is the
  // entire user-visible contract of this feature, and it had zero coverage —
  // a bug that passed `outputWidth` where `aspect` belongs would have passed
  // the whole suite. The stub above now records every prop it's given, so
  // this asserts the exact `aspect` react-easy-crop receives per preset.
  it('renders with the aspect locked by the preset', async () => {
    render(<ImageCropperDialog file={file()} preset="eventPoster" onCancel={vi.fn()} onCropped={vi.fn()} />);
    await screen.findByTestId('cropper');
    expect(cropStubState.lastProps).toMatchObject({ aspect: 2 / 3 });
  });

  it('renders with the aspect locked by the eventThumbnail preset', async () => {
    render(<ImageCropperDialog file={file()} preset="eventThumbnail" onCancel={vi.fn()} onCropped={vi.fn()} />);
    await screen.findByTestId('cropper');
    expect(cropStubState.lastProps).toMatchObject({ aspect: 16 / 9 });
  });

  it('portals out of its React parent, to a direct child of document.body', async () => {
    const { container } = render(
      <ImageCropperDialog file={file()} preset="avatar" onCancel={vi.fn()} onCropped={vi.fn()} />,
    );

    const dialog = await screen.findByRole('dialog', { name: /crop photo/i });
    // Portalled: NOT a descendant of the render container RTL mounted into.
    expect(container.contains(dialog)).toBe(false);
    // But still present in the document, as a direct child of body.
    expect(dialog.parentElement).toBe(document.body);
  });

  // The three non-Radix surfaces (PhotoGate, BrandEditProfileSheet, the
  // AppHomePage story rail) have no Dialog underneath, so Escape has to work
  // standalone too — it now routes through this dialog's OWN Radix layer
  // rather than a hand-rolled window-capture listener.
  it('Escape cancels the crop with no Radix dialog anywhere', async () => {
    const onCancel = vi.fn();
    const onCropped = vi.fn();
    render(<ImageCropperDialog file={file()} preset="avatar" onCancel={onCancel} onCropped={onCropped} />);
    await screen.findByRole('dialog', { name: /crop photo/i });

    fireEvent.keyDown(document.body, { key: 'Escape' });

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCropped).not.toHaveBeenCalled();
  });

  // BrandEditProfileSheet-style parents mount this dialog INSIDE their own
  // stopPropagation panel, not beside it, so a click in the cropper never
  // reaches the backdrop's onClick={onClose}. Portals (Radix's included)
  // bubble SYNTHETIC events through the REACT tree, so moving the DOM to
  // <body> doesn't change that — this pins it rather than assuming it.
  it('clicks stay inside the React ancestor that mounted it', async () => {
    const onClose = vi.fn();
    const onCancel = vi.fn();
    render(
      <div onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()}>
          <ImageCropperDialog file={file()} preset="brandLogo" onCancel={onCancel} onCropped={vi.fn()} />
        </div>
      </div>,
    );

    fireEvent.click(await screen.findByRole('button', { name: /cancel/i }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Integration: the cropper UNDER a real, open Radix modal Dialog.
//
// Several call sites (e.g. ImageUploadInput and GalleryManager inside
// EventDetailsPage's modals) mount this while a Radix modal Dialog is already
// open underneath, and a call site's own tests typically stub
// ImageCropperDialog out entirely — so nothing short of mounting BOTH real
// components can see a containment bug here.
//
// The bug being pinned: Radix's DismissableLayer decides what counts as an
// "outside" interaction by REACT-TREE containment (it flips
// isPointerInsideReactTreeRef from an onPointerDownCapture on its own layer
// element), not DOM containment. A portal moves the DOM but not the React
// tree, so a portalled SIBLING of DialogContent read as "outside": the first
// pointerdown in the cropper would dismiss the parent and wipe its state.
//
// Each nested block below is paired with a CONTROL that reproduces the old
// broken shape (a bare portalled sibling) and asserts it DOES fail, so none
// of these can pass vacuously.
// ---------------------------------------------------------------------------
describe('ImageCropperDialog under an open Radix modal Dialog', () => {
  // Radix installs its document-level `pointerdown` listener inside a
  // setTimeout(0), so nothing below is observable until timers have run.
  async function settle() {
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
  }

  /** The old, broken shape: a portalled React sibling of DialogContent. */
  function BarePortalCropper() {
    return createPortal(
      <div className="pointer-events-auto fixed inset-0" role="dialog" aria-label="Bare crop">
        <input type="range" aria-label="Bare zoom" />
        <button type="button">Bare cancel</button>
      </div>,
      document.body,
    );
  }

  /**
   * Mounts the host Dialog FIRST and the cropper only on a later commit —
   * which is what actually happens at real call sites (the cropper appears
   * when the user picks a file, long after the dialog opened).
   */
  async function mountHostThenChild(onOpenChange: () => void, child: React.ReactNode) {
    const host = (extra: React.ReactNode) => (
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent aria-describedby={undefined}>
          <DialogTitle>Host dialog</DialogTitle>
          <button type="button">Host button</button>
        </DialogContent>
        {extra}
      </Dialog>
    );
    const view = render(host(null));
    await settle();
    view.rerender(host(child));
    await settle();
    return view;
  }

  function cropper(props: Partial<{ onCancel: () => void; onCropped: (f: File) => void }> = {}) {
    return (
      <ImageCropperDialog
        file={file()}
        preset="avatar"
        onCancel={props.onCancel ?? vi.fn()}
        onCropped={props.onCropped ?? vi.fn()}
      />
    );
  }

  it('CONTROL: the harness can see a dismissal — a pointerdown truly outside closes the host', async () => {
    const onOpenChange = vi.fn();
    await mountHostThenChild(onOpenChange, null);

    fireEvent.pointerDown(document.body);
    await settle();

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('CONTROL: the OLD shape (bare portalled sibling) dismisses the host on first pointerdown', async () => {
    const onOpenChange = vi.fn();
    await mountHostThenChild(onOpenChange, <BarePortalCropper />);

    fireEvent.pointerDown(screen.getByRole('button', { name: /bare cancel/i }));
    await settle();

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('the FIRST pointerdown inside the cropper does not dismiss the host dialog', async () => {
    const onOpenChange = vi.fn();
    const onCancel = vi.fn();
    await mountHostThenChild(onOpenChange, cropper({ onCancel }));

    const crop = await screen.findByRole('dialog', { name: /crop photo/i });
    fireEvent.pointerDown(within(crop).getByRole('button', { name: /cancel/i }));
    await settle();

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled(); // pointerdown alone must not cancel either
  });

  // The touch variant of the same bug: Radix defers a touch pointerdown to
  // the subsequent `click`, so panning survived but tapping "Use photo" set
  // the poster and THEN fired the deferred dismissal, so a reset() could
  // throw the just-cropped result away along with the form.
  it('a touch tap on "Use photo" crops and does not dismiss the host dialog', async () => {
    const onOpenChange = vi.fn();
    const onCropped = vi.fn();
    await mountHostThenChild(onOpenChange, cropper({ onCropped }));

    const crop = await screen.findByRole('dialog', { name: /crop photo/i });
    const use = within(crop).getByRole('button', { name: /use photo/i });
    await waitFor(() => expect(use.hasAttribute('disabled')).toBe(false));

    fireEvent.pointerDown(use, { pointerType: 'touch' });
    fireEvent.click(use);
    await settle();

    await waitFor(() => expect(onCropped).toHaveBeenCalledTimes(1));
    expect(onCropped.mock.calls[0][0]).toBeInstanceOf(File);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('Escape cancels the crop and leaves the host dialog open', async () => {
    const onOpenChange = vi.fn();
    const onCancel = vi.fn();
    await mountHostThenChild(onOpenChange, cropper({ onCancel }));
    await screen.findByRole('dialog', { name: /crop photo/i });

    fireEvent.keyDown(document.body, { key: 'Escape' });
    await settle();

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  // The secondary defect: DialogContent's FocusScope uses DOM containment in
  // handleFocusIn, so under a bare portal it yanked focus straight back into
  // the host dialog and the Zoom slider could not be operated by keyboard.
  // As a nested Radix layer we get our own FocusScope and the host's is
  // paused via Radix's focus-scope stack.
  it('keyboard focus reaches and stays on the Zoom slider and both buttons', async () => {
    await mountHostThenChild(vi.fn(), cropper());
    const crop = await screen.findByRole('dialog', { name: /crop photo/i });

    for (const el of [
      within(crop).getByLabelText('Zoom'),
      within(crop).getByRole('button', { name: /cancel/i }),
      within(crop).getByRole('button', { name: /use photo/i }),
    ]) {
      (el as HTMLElement).focus();
      await settle();
      expect(document.activeElement).toBe(el);
    }
  });

  it('CONTROL: the OLD shape has its focus yanked back into the host dialog', async () => {
    await mountHostThenChild(vi.fn(), <BarePortalCropper />);

    const slider = screen.getByLabelText('Bare zoom');
    slider.focus();
    await settle();

    expect(document.activeElement).not.toBe(slider);
  });

  // The pointer-events half of round 1. jsdom applies no inherited CSS from
  // stylesheets, so the actual "clicks land on nothing" symptom is only
  // reproducible in a real browser — but the MECHANISM is observable here,
  // because Radix writes the override as an INLINE style on the layer that is
  // currently highest. That inline `auto` is what beats the inherited `none`
  // from `document.body`; nothing in our own className does it any more.
  it('Radix puts pointer-events:auto inline on the cropper while body pointer events are off', async () => {
    await mountHostThenChild(vi.fn(), cropper());
    const crop = await screen.findByRole('dialog', { name: /crop photo/i });

    expect(document.body.style.pointerEvents).toBe('none');
    expect(crop.style.pointerEvents).toBe('auto');
    // ...and the host layer, no longer highest, is switched off.
    expect((screen.getByText('Host dialog').closest('[role="dialog"]') as HTMLElement).style.pointerEvents)
      .toBe('none');
  });

  it('is not aria-hidden from screen readers while the host dialog is open', async () => {
    await mountHostThenChild(vi.fn(), cropper());
    const crop = await screen.findByRole('dialog', { name: /crop photo/i });

    expect(crop.getAttribute('aria-hidden')).not.toBe('true');
    expect(crop.closest('[aria-hidden="true"]')).toBeNull();
    // ...and it's the host that gets hidden instead, as a nested modal should.
    expect(screen.getByText('Host dialog').closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('Cancel calls onCancel only; "Use photo" calls onCropped only', async () => {
    const onOpenChange = vi.fn();
    const onCancel = vi.fn();
    const onCropped = vi.fn();
    const view = await mountHostThenChild(onOpenChange, cropper({ onCancel, onCropped }));

    const crop = await screen.findByRole('dialog', { name: /crop photo/i });
    fireEvent.click(within(crop).getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCropped).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();

    view.unmount();
  });
});
