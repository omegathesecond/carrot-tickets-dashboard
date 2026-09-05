// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { BarcodeField } from '@/components/BarcodeField';

// The installed @zxing/browser (0.2.1) has no `reset()` on the reader at all:
// `decodeFromVideoDevice` resolves to an `IScannerControls` object whose
// `stop()` ends the scan loop. The mock below matches that shape rather than
// the older reader.reset() API.
const decodeFromImageElement = vi.fn();
const decodeFromVideoDevice = vi.fn();
const scannerStop = vi.fn();

vi.mock('@zxing/browser', () => ({
  BrowserMultiFormatReader: class {
    decodeFromImageElement = decodeFromImageElement;
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
    decodeFromImageElement.mockResolvedValue({ getText: () => '6001240100015' });
    const onChange = vi.fn();
    render(<BarcodeField value="" onChange={onChange} />);

    const file = new File([new Uint8Array([1, 2, 3])], 'bottle.png', { type: 'image/png' });
    fireEvent.change(screen.getByTestId('barcode-photo-input'), { target: { files: [file] } });

    await waitFor(() => expect(onChange).toHaveBeenCalledWith('6001240100015'));
  });

  it('says so when a photo has no readable barcode, and keeps what was typed', async () => {
    withCamera(false);
    decodeFromImageElement.mockRejectedValue(new Error('NotFoundException'));
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

  it('stops the camera stream when Stop is clicked', async () => {
    withCamera(true);
    render(<BarcodeField value="" onChange={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /scan/i }));
    await waitFor(() => expect(decodeFromVideoDevice).toHaveBeenCalled());

    fireEvent.click(await screen.findByRole('button', { name: /stop/i }));
    await waitFor(() => expect(scannerStop).toHaveBeenCalled());
  });
});
