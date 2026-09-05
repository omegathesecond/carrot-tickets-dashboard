// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { BarcodeField } from '@/components/BarcodeField';

// The installed @zxing/browser (0.2.1) has no `reset()` on the reader at all:
// `decodeFromVideoDevice` resolves to an `IScannerControls` object whose
// `stop()` ends the scan loop. The mock below matches that shape rather than
// the older reader.reset() API.
//
// It mocks decodeFromImageUrl, not decodeFromImageElement — the real
// decodeFromImageElement treats a string argument as a DOM element id
// (document.getElementById) rather than a URL, so a component that passed
// our blob: URL to it would throw on every real photo while this mock,
// stubbing the wrong method, would just report "not called". Mocking the
// URL-accepting method means a regression back to the element-accepting one
// fails here instead of only in a real browser.
const decodeFromImageUrl = vi.fn();
const decodeFromVideoDevice = vi.fn();
const scannerStop = vi.fn();

vi.mock('@zxing/browser', () => ({
  BrowserMultiFormatReader: class {
    decodeFromImageUrl = decodeFromImageUrl;
    decodeFromVideoDevice = decodeFromVideoDevice;
  },
}));

beforeEach(() => {
  global.URL.createObjectURL = vi.fn(() => 'blob:barcode-photo');
  global.URL.revokeObjectURL = vi.fn();
  decodeFromVideoDevice.mockResolvedValue({ stop: scannerStop });
});

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const withCamera = (present: boolean) => {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: present ? { getUserMedia: vi.fn() } : undefined,
  });
};

describe('BarcodeField', () => {
  it('always renders the typed input', () => {
    withCamera(false);
    render(<BarcodeField value="6001240100015" onChange={vi.fn()} />);
    expect(screen.getByDisplayValue('6001240100015')).toBeTruthy();
  });

  it('hides Scan when the device has no camera, and keeps Photo', () => {
    // A laptop with no webcam, or any non-HTTPS origin — browsers gate
    // getUserMedia on a secure context, so its absence covers both.
    withCamera(false);
    render(<BarcodeField value="" onChange={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /scan/i })).toBeNull();
    expect(screen.getByRole('button', { name: /photo/i })).toBeTruthy();
  });

  it('offers Scan when a camera is present', () => {
    withCamera(true);
    render(<BarcodeField value="" onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /scan/i })).toBeTruthy();
  });

  it('fills the field from a decoded photo', async () => {
    withCamera(false);
    decodeFromImageUrl.mockResolvedValue({ getText: () => '6001240100015' });
    const onChange = vi.fn();
    render(<BarcodeField value="" onChange={onChange} />);

    const file = new File([new Uint8Array([1, 2, 3])], 'bottle.png', { type: 'image/png' });
    fireEvent.change(screen.getByTestId('barcode-photo-input'), { target: { files: [file] } });

    await waitFor(() => expect(onChange).toHaveBeenCalledWith('6001240100015'));
    // Must be the URL-accepting call, not the element-id one — passing this
    // same blob: string to decodeFromImageElement would throw in production.
    expect(decodeFromImageUrl).toHaveBeenCalledWith('blob:barcode-photo');
  });

  it('says so when a photo has no readable barcode, and keeps what was typed', async () => {
    withCamera(false);
    decodeFromImageUrl.mockRejectedValue(new Error('NotFoundException'));
    const onChange = vi.fn();
    render(<BarcodeField value="already typed" onChange={onChange} />);

    const file = new File([new Uint8Array([1])], 'blurry.png', { type: 'image/png' });
    fireEvent.change(screen.getByTestId('barcode-photo-input'), { target: { files: [file] } });

    expect(await screen.findByText(/no barcode/i)).toBeTruthy();
    // A failed decode must never wipe the field.
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('already typed')).toBeTruthy();
  });

  it('reports a denied camera rather than looking broken', async () => {
    withCamera(true);
    decodeFromVideoDevice.mockRejectedValue(
      Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' }),
    );
    render(<BarcodeField value="" onChange={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /scan/i }));

    expect(await screen.findByText(/camera/i)).toBeTruthy();
  });

  it('hands the real mounted <video> element to decodeFromVideoDevice, not a null ref', async () => {
    // A mock satisfies "decodeFromVideoDevice was called" no matter what its
    // second argument is. The real @zxing/browser builds its OWN detached
    // <video> when handed null, so the organizer's on-screen element never
    // gets the camera stream. Only an instanceof check on the real DOM type
    // catches that — a mock-shaped assertion would pass either way.
    withCamera(true);
    render(<BarcodeField value="" onChange={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /scan/i }));
    await waitFor(() => expect(decodeFromVideoDevice).toHaveBeenCalled());

    expect(decodeFromVideoDevice.mock.calls[0][1]).toBeInstanceOf(HTMLVideoElement);
  });

  it('stops the camera stream when Stop is clicked', async () => {
    withCamera(true);
    render(<BarcodeField value="" onChange={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /scan/i }));
    await waitFor(() => expect(decodeFromVideoDevice).toHaveBeenCalled());

    fireEvent.click(await screen.findByRole('button', { name: /stop/i }));
    await waitFor(() => expect(scannerStop).toHaveBeenCalled());
  });

  it('stops a camera whose permission prompt resolves after Stop was already clicked', async () => {
    // The native permission prompt can stay open indefinitely. If the
    // organizer gives up and clicks Stop before it resolves, and the browser
    // grants access anyway a moment later, the resulting stream must be
    // killed immediately — otherwise nothing left holds a reference to it
    // and the camera runs forever.
    withCamera(true);
    let resolveDecode!: (controls: { stop: () => void }) => void;
    decodeFromVideoDevice.mockReturnValue(
      new Promise((resolve) => { resolveDecode = resolve; }),
    );
    const lateStop = vi.fn();

    render(<BarcodeField value="" onChange={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /scan/i }));
    await waitFor(() => expect(decodeFromVideoDevice).toHaveBeenCalled());

    // The prompt is still pending — Stop is clicked before it answers.
    fireEvent.click(screen.getByRole('button', { name: /stop/i }));

    // The browser resolves permission after the organizer already gave up.
    resolveDecode({ stop: lateStop });

    await waitFor(() => expect(lateStop).toHaveBeenCalled());
  });

  it('does not let a superseded scan adopt its late permission grant after a second scan has started', async () => {
    // Neighbouring sequence to the one above: Scan, Stop (while pending),
    // Scan again — a single boolean "cancelled" flag would get cleared by
    // the second attempt and wrongly let the *first* attempt's late grant
    // through. Each attempt must own only its own stream.
    withCamera(true);
    let resolveFirst!: (controls: { stop: () => void }) => void;
    const firstStop = vi.fn();
    const secondStop = vi.fn();

    decodeFromVideoDevice
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockImplementationOnce(() => Promise.resolve({ stop: secondStop }));

    render(<BarcodeField value="" onChange={vi.fn()} />);

    // First attempt: permission prompt opens and does not answer yet.
    fireEvent.click(screen.getByRole('button', { name: /scan/i }));
    await waitFor(() => expect(decodeFromVideoDevice).toHaveBeenCalledTimes(1));

    // Organizer gives up waiting and clicks Stop while it's still pending.
    fireEvent.click(screen.getByRole('button', { name: /stop/i }));

    // Organizer tries again — a second attempt starts and (this time) resolves.
    fireEvent.click(screen.getByRole('button', { name: /scan/i }));
    await waitFor(() => expect(decodeFromVideoDevice).toHaveBeenCalledTimes(2));

    // The first prompt is *finally* granted, after the second attempt already took over.
    resolveFirst({ stop: firstStop });

    // The first attempt's stream must be shut down immediately...
    await waitFor(() => expect(firstStop).toHaveBeenCalled());
    // ...and never touch the second attempt's stream, which is the one now active.
    expect(secondStop).not.toHaveBeenCalled();
  });
});
