// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { ImageUploadField } from '@/components/ImageUploadField';

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('ImageUploadField', () => {
  it('uploads the chosen file and reports the returned url', async () => {
    const onUpload = vi.fn().mockResolvedValue('https://cdn.example/burger.jpg');
    const onChange = vi.fn();
    render(<ImageUploadField value="" onChange={onChange} onUpload={onUpload} />);

    const file = new File([new Uint8Array([1])], 'burger.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByTestId('image-upload-input'), { target: { files: [file] } });

    await waitFor(() => expect(onChange).toHaveBeenCalledWith('https://cdn.example/burger.jpg'));
  });

  it('surfaces an upload failure and leaves the existing image alone', async () => {
    const onUpload = vi.fn().mockRejectedValue(new Error('File too large'));
    const onChange = vi.fn();
    render(<ImageUploadField value="https://cdn.example/old.jpg" onChange={onChange} onUpload={onUpload} />);

    const file = new File([new Uint8Array([1])], 'huge.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByTestId('image-upload-input'), { target: { files: [file] } });

    expect(await screen.findByText(/file too large/i)).toBeTruthy();
    // A failed upload must not clear an image that is already saved.
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows a preview of the current image and can clear it', () => {
    const onChange = vi.fn();
    render(<ImageUploadField value="https://cdn.example/old.jpg" onChange={onChange} onUpload={vi.fn()} />);

    expect(screen.getByRole('img')).toHaveProperty('src', 'https://cdn.example/old.jpg');
    fireEvent.click(screen.getByRole('button', { name: /remove/i }));
    expect(onChange).toHaveBeenCalledWith('');
  });
});
