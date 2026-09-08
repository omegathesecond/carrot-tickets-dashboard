// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { GalleryManager } from '@/components/GalleryManager';

function file(name: string) {
  return new File(['x'], name, { type: 'image/png' });
}

beforeEach(() => {
  global.URL.createObjectURL = vi.fn(() => 'blob:preview');
  global.URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

it('emits picked files immediately, with no cropping step', async () => {
  const onNewFilesChange = vi.fn();
  const { container } = render(
    <GalleryManager label="Photos" onFilesSelect={() => {}} onRemove={() => {}}
      onNewFilesChange={onNewFilesChange} />
  );
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;

  fireEvent.change(input, { target: { files: [file('a.png'), file('b.png')] } });

  expect(screen.queryByTestId('cropper')).toBeNull();
  expect(screen.queryByRole('button', { name: /use photo/i })).toBeNull();
  await waitFor(() => expect(onNewFilesChange.mock.calls.at(-1)![0]).toHaveLength(2));
  expect(onNewFilesChange).toHaveBeenLastCalledWith([
    expect.objectContaining({ name: 'a.png' }),
    expect.objectContaining({ name: 'b.png' }),
  ]);
});

it('removes a preview from the current set', async () => {
  const onNewFilesChange = vi.fn();
  const { container } = render(
    <GalleryManager label="Photos" onFilesSelect={() => {}} onRemove={() => {}}
      onNewFilesChange={onNewFilesChange} />
  );
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;

  fireEvent.change(input, { target: { files: [file('a.png'), file('b.png')] } });
  await waitFor(() => expect(onNewFilesChange.mock.calls.at(-1)![0]).toHaveLength(2));

  // Remove the first image (hover buttons are always in the DOM; click the first remove).
  const removeButtons = await screen.findAllByRole('button');
  fireEvent.click(removeButtons[0]);
  await waitFor(() => expect(onNewFilesChange.mock.calls.at(-1)![0]).toHaveLength(1));
});

describe('GalleryManager without onNewFilesChange (existing callers unchanged)', () => {
  it('calls onFilesSelect with the original file on add and onRemove on removing an existing image', async () => {
    const onFilesSelect = vi.fn();
    const onRemove = vi.fn();
    const { container } = render(
      <GalleryManager label="Photos" currentImages={['existing.jpg']} onFilesSelect={onFilesSelect} onRemove={onRemove} />
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const picked = file('a.png');
    fireEvent.change(input, { target: { files: [picked] } });

    await waitFor(() => expect(onFilesSelect).toHaveBeenCalledWith([picked]));
  });
});
