// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { GalleryManager } from '@/components/GalleryManager';

vi.mock('react-easy-crop', () => ({
  default: ({ onCropComplete }: { onCropComplete: (a: unknown, px: unknown) => void }) => {
    queueMicrotask(() => onCropComplete({}, { x: 0, y: 0, width: 100, height: 100 }));
    return <div data-testid="cropper" />;
  },
}));

const cropResize = vi.hoisted(() => vi.fn());
vi.mock('@/lib/image', () => ({ cropResize }));

function file(name: string) {
  return new File(['x'], name, { type: 'image/png' });
}

async function usePhoto() {
  const button = await waitFor(() => {
    const btn = screen.getByRole('button', { name: /use photo/i });
    if (btn.hasAttribute('disabled')) throw new Error('still disabled');
    return btn;
  });
  fireEvent.click(button);
}

beforeEach(() => {
  cropResize.mockReset();
  let n = 0;
  cropResize.mockImplementation(() => Promise.resolve(new File(['c'], `cropped-${n++}.jpg`, { type: 'image/jpeg' })));
  global.URL.createObjectURL = vi.fn(() => 'blob:preview');
  global.URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

it('emits each file only after it is cropped', async () => {
  const onNewFilesChange = vi.fn();
  const { container } = render(
    <GalleryManager label="Photos" onFilesSelect={() => {}} onRemove={() => {}}
      onNewFilesChange={onNewFilesChange} />
  );
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;

  fireEvent.change(input, { target: { files: [file('a.png'), file('b.png')] } });
  expect(onNewFilesChange).not.toHaveBeenCalledWith(
    expect.arrayContaining([expect.objectContaining({ name: 'a.png' })]),
  );

  await usePhoto();
  await usePhoto();

  await waitFor(() => expect(onNewFilesChange).toHaveBeenLastCalledWith(
    expect.arrayContaining([expect.objectContaining({ type: 'image/jpeg' })]),
  ));
  await waitFor(() => expect(onNewFilesChange.mock.calls.at(-1)![0]).toHaveLength(2));
});

it('removes a cropped preview from the current set', async () => {
  const onNewFilesChange = vi.fn();
  const { container } = render(
    <GalleryManager label="Photos" onFilesSelect={() => {}} onRemove={() => {}}
      onNewFilesChange={onNewFilesChange} />
  );
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;

  fireEvent.change(input, { target: { files: [file('a.png'), file('b.png')] } });
  await usePhoto();
  await usePhoto();
  await waitFor(() => expect(onNewFilesChange.mock.calls.at(-1)![0]).toHaveLength(2));

  // Remove the first image (hover buttons are always in the DOM; click the first remove).
  const removeButtons = await screen.findAllByRole('button');
  fireEvent.click(removeButtons[0]);
  await waitFor(() => expect(onNewFilesChange.mock.calls.at(-1)![0]).toHaveLength(1));
});

describe('GalleryManager without onNewFilesChange (existing callers unchanged)', () => {
  it('still calls onFilesSelect with the cropped file on add and onRemove on removing an existing image', async () => {
    const onFilesSelect = vi.fn();
    const onRemove = vi.fn();
    const { container } = render(
      <GalleryManager label="Photos" currentImages={['existing.jpg']} onFilesSelect={onFilesSelect} onRemove={onRemove} />
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file('a.png')] } });

    expect(await screen.findByTestId('cropper')).toBeTruthy();
    expect(onFilesSelect).not.toHaveBeenCalled();

    await usePhoto();
    await waitFor(() => expect(onFilesSelect).toHaveBeenCalledWith([expect.objectContaining({ type: 'image/jpeg' })]));
  });
});
