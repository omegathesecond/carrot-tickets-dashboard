// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UpdateComposer } from '@/components/updates/UpdateComposer';

vi.mock('react-easy-crop', () => ({
  default: ({ onCropComplete }: { onCropComplete: (a: unknown, px: unknown) => void }) => {
    queueMicrotask(() => onCropComplete({}, { x: 0, y: 0, width: 100, height: 100 }));
    return <div data-testid="cropper" />;
  },
}));

const cropResize = vi.hoisted(() => vi.fn());
vi.mock('@/lib/image', () => ({ cropResize }));

vi.mock('@/lib/api', () => ({
  apiClient: {
    events: { getEvents: vi.fn().mockResolvedValue({ data: [] }) },
    updates: { init: vi.fn(), uploadToR2: vi.fn(), finalize: vi.fn(), getPublic: vi.fn() },
  },
}));

beforeEach(() => {
  cropResize.mockReset();
  cropResize.mockResolvedValue(new File(['c'], 'update.jpg', { type: 'image/jpeg' }));
  global.URL.createObjectURL = vi.fn(() => 'blob:preview');
  global.URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

function renderComposer() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <UpdateComposer />
    </QueryClientProvider>,
  );
}

describe('UpdateComposer', () => {
  it('opens the cropper for an image pick', async () => {
    const { container } = renderComposer();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['b'], 'p.png', { type: 'image/png' })] } });
    expect(await screen.findByTestId('cropper')).toBeTruthy();
  });

  it('does not open the cropper for a video pick', async () => {
    const { container } = renderComposer();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['b'], 'v.mp4', { type: 'video/mp4' })] } });
    await waitFor(() => expect(screen.queryByTestId('cropper')).toBeNull());
    expect(await screen.findByText('v.mp4')).toBeTruthy();
  });

  it('emits the cropped file once confirmed', async () => {
    const { container } = renderComposer();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['b'], 'p.png', { type: 'image/png' })] } });

    fireEvent.click(await screen.findByRole('button', { name: /use photo/i }));

    expect(await screen.findByText('update.jpg')).toBeTruthy();
    expect(screen.queryByTestId('cropper')).toBeNull();
  });
});
