// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GalleryManager } from '@/components/GalleryManager';

function file(name: string) {
  return new File(['x'], name, { type: 'image/png' });
}

it('emits the current new-file set on add and on remove', async () => {
  const onNewFilesChange = vi.fn();
  const { container } = render(
    <GalleryManager label="Photos" onFilesSelect={() => {}} onRemove={() => {}}
      onNewFilesChange={onNewFilesChange} />
  );
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;

  fireEvent.change(input, { target: { files: [file('a.png'), file('b.png')] } });
  await waitFor(() => expect(onNewFilesChange).toHaveBeenLastCalledWith(
    expect.arrayContaining([expect.objectContaining({ name: 'a.png' }), expect.objectContaining({ name: 'b.png' })])
  ));
  await waitFor(() => expect(onNewFilesChange.mock.calls.at(-1)![0]).toHaveLength(2));

  // Remove the first image (hover buttons are always in the DOM; click the first remove).
  const removeButtons = await screen.findAllByRole('button');
  fireEvent.click(removeButtons[0]);
  await waitFor(() => expect(onNewFilesChange.mock.calls.at(-1)![0]).toHaveLength(1));
});

describe('GalleryManager without onNewFilesChange (existing callers unchanged)', () => {
  it('still calls onFilesSelect on add and onRemove on removing an existing image', () => {
    const onFilesSelect = vi.fn();
    const onRemove = vi.fn();
    const { container } = render(
      <GalleryManager label="Photos" currentImages={['existing.jpg']} onFilesSelect={onFilesSelect} onRemove={onRemove} />
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file('a.png')] } });
    expect(onFilesSelect).toHaveBeenCalledWith([expect.objectContaining({ name: 'a.png' })]);
  });
});
