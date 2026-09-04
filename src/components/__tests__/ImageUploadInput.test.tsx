// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { ImageUploadInput } from '@/components/ImageUploadInput';

vi.mock('react-easy-crop', () => ({
  default: ({ onCropComplete }: { onCropComplete: (a: unknown, px: unknown) => void }) => {
    queueMicrotask(() => onCropComplete({}, { x: 0, y: 0, width: 100, height: 100 }));
    return <div data-testid="cropper" />;
  },
}));

const cropResize = vi.hoisted(() => vi.fn());
vi.mock('@/lib/image', () => ({ cropResize }));

beforeEach(() => {
  cropResize.mockReset();
  cropResize.mockResolvedValue(new File(['c'], 'poster.jpg', { type: 'image/jpeg' }));
  global.URL.createObjectURL = vi.fn(() => 'blob:preview');
  global.URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

function pick(container: HTMLElement, file: File) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
}

describe('ImageUploadInput', () => {
  it('opens the cropper on pick instead of emitting the raw file', async () => {
    const onFileSelect = vi.fn();
    const { container } = render(
      <ImageUploadInput label="Event Poster" preset="eventPoster" onFileSelect={onFileSelect} />,
    );

    pick(container, new File(['b'], 'raw.png', { type: 'image/png' }));

    expect(await screen.findByTestId('cropper')).toBeTruthy();
    expect(onFileSelect).not.toHaveBeenCalled();
  });

  it('emits the cropped file once confirmed', async () => {
    const onFileSelect = vi.fn();
    const { container } = render(
      <ImageUploadInput label="Event Poster" preset="eventPoster" onFileSelect={onFileSelect} />,
    );
    pick(container, new File(['b'], 'raw.png', { type: 'image/png' }));

    fireEvent.click(await screen.findByRole('button', { name: /use photo/i }));

    await waitFor(() => expect(onFileSelect).toHaveBeenCalledTimes(1));
    expect(onFileSelect.mock.calls[0][0].name).toBe('poster.jpg');
  });

  it('rejects an oversized file without opening the cropper', async () => {
    const onFileSelect = vi.fn();
    const big = new File([new Uint8Array(3 * 1024 * 1024)], 'big.png', { type: 'image/png' });
    const { container } = render(
      <ImageUploadInput label="Event Poster" preset="eventPoster" maxSize={2} onFileSelect={onFileSelect} />,
    );

    pick(container, big);

    expect(await screen.findByText(/less than 2MB/i)).toBeTruthy();
    expect(screen.queryByTestId('cropper')).toBeNull();
    expect(onFileSelect).not.toHaveBeenCalled();
  });
});
