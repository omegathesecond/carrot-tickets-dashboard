// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { ImageUploadInput } from '@/components/ImageUploadInput';

beforeEach(() => {
  global.URL.createObjectURL = vi.fn(() => 'blob:preview');
  global.URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

function pick(container: HTMLElement, file: File) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
}

describe('ImageUploadInput', () => {
  it('emits the original file on pick, with no cropping step', async () => {
    const onFileSelect = vi.fn();
    const { container } = render(
      <ImageUploadInput label="Event Poster" onFileSelect={onFileSelect} />,
    );

    const raw = new File(['b'], 'raw.png', { type: 'image/png' });
    pick(container, raw);

    await waitFor(() => expect(onFileSelect).toHaveBeenCalledTimes(1));
    expect(onFileSelect).toHaveBeenCalledWith(raw);
    expect(screen.queryByRole('button', { name: /use photo/i })).toBeNull();
    expect(screen.queryByLabelText(/zoom/i)).toBeNull();
  });

  it('shows a preview of the uploaded image once picked', async () => {
    const { container } = render(
      <ImageUploadInput label="Event Poster" onFileSelect={vi.fn()} />,
    );

    pick(container, new File(['b'], 'raw.png', { type: 'image/png' }));

    expect(await screen.findByAltText('Preview')).toBeTruthy();
  });

  it('rejects an oversized file without emitting or previewing it', async () => {
    const onFileSelect = vi.fn();
    const big = new File([new Uint8Array(3 * 1024 * 1024)], 'big.png', { type: 'image/png' });
    const { container } = render(
      <ImageUploadInput label="Event Poster" maxSize={2} onFileSelect={onFileSelect} />,
    );

    pick(container, big);

    expect(await screen.findByText(/less than 2MB/i)).toBeTruthy();
    expect(screen.queryByAltText('Preview')).toBeNull();
    expect(onFileSelect).not.toHaveBeenCalled();
  });

  it('lets the organizer remove the image and pick a different one', async () => {
    const onFileSelect = vi.fn();
    const onRemove = vi.fn();
    const { container } = render(
      <ImageUploadInput label="Event Poster" onFileSelect={onFileSelect} onRemove={onRemove} />,
    );

    pick(container, new File(['b'], 'raw.png', { type: 'image/png' }));
    await screen.findByAltText('Preview');

    fireEvent.click(screen.getByRole('button', { name: /remove/i }));
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(screen.queryByAltText('Preview')).toBeNull();

    const second = new File(['c'], 'second.png', { type: 'image/png' });
    pick(container, second);
    await waitFor(() => expect(onFileSelect).toHaveBeenLastCalledWith(second));
  });
});
