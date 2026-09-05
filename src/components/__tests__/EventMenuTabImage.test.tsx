// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { EventMenuTab } from '@/components/EventMenuTab';

// Same mock shape as EventRegisterPanel.test.tsx — lets any rejection surface
// as a visible toast rather than a silent no-op.
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

// Radix Select needs two things jsdom doesn't ship — same polyfill as
// EventMenuTabCategory.test.tsx / StallOperatorsPanel.test.tsx.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
if (typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = () => {};
}

const listItems = vi.fn();
const createItem = vi.fn();
const listOrders = vi.fn();
const listMerchants = vi.fn();
const listProducts = vi.fn();
const uploadMenuItemImage = vi.fn();

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    apiClient: {
      menu: {
        listItems: (...a: unknown[]) => listItems(...a),
        createItem: (_eventId: string, data: unknown) => createItem(data),
        listOrders: (...a: unknown[]) => listOrders(...a),
      },
      merchants: { list: (...a: unknown[]) => listMerchants(...a) },
      stock: { listProducts: (...a: unknown[]) => listProducts(...a) },
      events: {
        // Same call shape as EventCatalogueImage.test.tsx's uploadProductImage.
        uploadMenuItemImage: (...a: unknown[]) => uploadMenuItemImage(...a),
      },
    },
  };
});

beforeEach(() => {
  listItems.mockResolvedValue([]);
  createItem.mockResolvedValue({ _id: 'new-item' });
  listOrders.mockResolvedValue([]);
  listMerchants.mockResolvedValue([]);
  listProducts.mockResolvedValue([]);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/** Renders EventMenuTab and waits for the empty-state add button to appear. */
const renderMenuTab = async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <EventMenuTab eventId="e1" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await screen.findByRole('button', { name: 'Add menu item' });
};

/** Clicks the header's add-item trigger and waits for the dialog to mount. */
const openAddItemDialog = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Add menu item' }));
  return screen.findByRole('dialog');
};

describe('EventMenuTab item image', () => {
  it('keeps what was typed elsewhere while the image upload is still pending', async () => {
    // ImageUploadField.onChange writes through setForm({ ...form, imageUrl })
    // here too — same stale-closure trap as the catalogue form
    // (EventCatalogueImage.test.tsx). This test types into the name field
    // WHILE the upload is pending, not after, which is what would step
    // around the bug.
    let resolveUpload!: (url: string) => void;
    uploadMenuItemImage.mockReturnValue(new Promise((resolve) => { resolveUpload = resolve; }));
    await renderMenuTab();
    const dialog = await openAddItemDialog();

    const file = new File([new Uint8Array([1])], 'burger.jpg', { type: 'image/jpeg' });
    fireEvent.change(within(dialog).getByTestId('image-upload-input'), { target: { files: [file] } });

    // Type into the name field WHILE the upload is pending.
    fireEvent.change(within(dialog).getByPlaceholderText('Stoney Ginger Beer 300ml'), {
      target: { value: 'Test Item' },
    });

    await act(async () => { resolveUpload('https://cdn.example/burger.jpg'); });
    await within(dialog).findByRole('img');

    expect(within(dialog).getByDisplayValue('Test Item')).toBeTruthy();
  });
});
