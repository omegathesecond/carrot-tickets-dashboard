// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { EventCataloguePanel } from '@/components/cashless/EventCataloguePanel';

// Same mock shape as BarcodeField.test.tsx: decodeFromImageUrl is what the
// component's photo-decode path actually calls.
const decodeFromImageUrl = vi.fn();
vi.mock('@zxing/browser', () => ({
  BrowserMultiFormatReader: class {
    decodeFromImageUrl = decodeFromImageUrl;
  },
}));

// Same importOriginal shape as StallOperatorsPanel.test.tsx / EventMenuTabCategory.test.tsx —
// keeps the real PRODUCT_CATEGORIES export while faking the network-touching methods.
const listProducts = vi.fn();
const createProduct = vi.fn();
const updateProduct = vi.fn();
const listMerchants = vi.fn();
const getEventStockBoard = vi.fn();
const uploadProductImage = vi.fn();
const getAllocations = vi.fn();
const setAllocations = vi.fn();

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    apiClient: {
      stock: {
        listProducts: (...a: unknown[]) => listProducts(...a),
        createProduct: (...a: unknown[]) => createProduct(...a),
        updateProduct: (...a: unknown[]) => updateProduct(...a),
        getAllocations: (...a: unknown[]) => getAllocations(...a),
        setAllocations: (...a: unknown[]) => setAllocations(...a),
      },
      merchants: { list: (...a: unknown[]) => listMerchants(...a) },
      events: {
        getEventStockBoard: (...a: unknown[]) => getEventStockBoard(...a),
        // The endpoint under test: mirrors uploadMenuItemImage's shape one
        // level up, against apiClient.events (Task 3's convention for every
        // media-upload method, not just menu items).
        uploadProductImage: (...a: unknown[]) => uploadProductImage(...a),
      },
    },
  };
});

const EXISTING_PRODUCT = {
  _id: 'p1',
  name: 'Castle Lite 330ml',
  category: 'beer',
  price: 2500,
  barcode: '6001240100015',
  unitLabel: 'unit',
  unitsPerPack: 24,
  packLabel: 'case',
  imageUrl: 'https://cdn.example/old.jpg',
  active: true,
};

// A real event has stalls, and the create/edit save path allocates to
// whichever were ticked — image upload doesn't touch that, but before this
// fix `listMerchants` resolved to `[]`, which took every test below down the
// no-stalls branch and never exercised `setAllocations` at all. That made
// this file's coverage of image-upload-on-save run a path no real event
// takes.
const STALL = { _id: 'm-bar', name: 'Bar' };

beforeEach(() => {
  global.URL.createObjectURL = vi.fn(() => 'blob:barcode-photo');
  global.URL.revokeObjectURL = vi.fn();
  listProducts.mockResolvedValue([]);
  createProduct.mockResolvedValue({ _id: 'new-product' });
  updateProduct.mockResolvedValue({});
  listMerchants.mockResolvedValue([STALL]);
  getAllocations.mockResolvedValue({ allocations: {} });
  setAllocations.mockResolvedValue({ allocated: [] });
  getEventStockBoard.mockResolvedValue({
    event: { id: 'e1', name: 'Cashless Tap Test' },
    perBar: [],
    byProduct: [],
  });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

/** Renders the catalogue tab, landed directly on the price-list view. */
async function renderCataloguePanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/events/e1?tab=cashless&sub=catalogue&view=catalogue']}>
        <EventCataloguePanel eventId="e1" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await screen.findByRole('button', { name: /Add product/ });
}

async function openAddProductDialog() {
  fireEvent.click(screen.getByRole('button', { name: /Add product/ }));
  return screen.findByRole('dialog');
}

/**
 * Fills the two fields every submit needs (name, price) and submits — scoped
 * to the dialog, since the header's "Add product" trigger and the dialog's
 * own submit button share the exact same label.
 */
async function fillRequiredFieldsAndSubmit() {
  const dialog = screen.getByRole('dialog');
  fireEvent.change(within(dialog).getByPlaceholderText('Castle Lite 330ml'), {
    target: { value: 'Test Product' },
  });
  fireEvent.change(within(dialog).getByPlaceholderText('25.00'), { target: { value: '10.00' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Add product' }));
}

describe('EventCataloguePanel product image', () => {
  it('sends the uploaded image url when creating a product', async () => {
    uploadProductImage.mockResolvedValue('https://cdn.example/castle.jpg');
    await renderCataloguePanel();
    await openAddProductDialog();

    const file = new File([new Uint8Array([1])], 'castle.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByTestId('image-upload-input'), { target: { files: [file] } });
    await screen.findByRole('img');
    await fillRequiredFieldsAndSubmit();

    await waitFor(() =>
      expect(createProduct).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ imageUrl: 'https://cdn.example/castle.jpg' }),
      ),
    );
  });

  it('keeps what was typed elsewhere while the image upload is still pending', async () => {
    // setForm({ ...form, imageUrl }) at the ImageUploadField call site
    // captures `form` from the render when the file was chosen. Anything
    // typed into another field while the upload is in flight is thrown away
    // when that stale closure fires on resolve. The other test above awaits
    // findByRole('img') BEFORE typing, which steps around this exact bug —
    // this one types WHILE the upload is still pending.
    let resolveUpload!: (url: string) => void;
    uploadProductImage.mockReturnValue(new Promise((resolve) => { resolveUpload = resolve; }));
    await renderCataloguePanel();
    const dialog = await openAddProductDialog();

    const file = new File([new Uint8Array([1])], 'castle.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByTestId('image-upload-input'), { target: { files: [file] } });

    // Type into the name field WHILE the upload is pending.
    fireEvent.change(within(dialog).getByPlaceholderText('Castle Lite 330ml'), {
      target: { value: 'Test Product' },
    });

    await act(async () => { resolveUpload('https://cdn.example/castle.jpg'); });
    await screen.findByRole('img');

    expect(within(dialog).getByDisplayValue('Test Product')).toBeTruthy();
  });

  it('omits imageUrl entirely when no image was chosen', async () => {
    await renderCataloguePanel();
    await openAddProductDialog();
    await fillRequiredFieldsAndSubmit();

    // The API validates imageUrl as a URI; sending '' would be a 400.
    await waitFor(() => expect(createProduct).toHaveBeenCalled());
    const [, payload] = createProduct.mock.calls[0];
    expect(payload.imageUrl).toBeUndefined();
  });

  it('sends null for imageUrl when an existing image is removed during edit', async () => {
    // The other direction of the same trap: updateProductSchema allows null
    // to CLEAR the field, but omitting the key means "leave unchanged" — so
    // clearing a previously-saved image must send imageUrl: null, not omit it.
    listProducts.mockResolvedValue([EXISTING_PRODUCT]);
    await renderCataloguePanel();
    const row = (await screen.findByText('Castle Lite 330ml')).closest('tr')!;

    // The row now carries several buttons (product detail, inline price edit,
    // the pencil), so name the pencil rather than taking the row's only one.
    fireEvent.click(within(row).getByRole('button', { name: /^Edit Castle Lite 330ml$/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('img')).toHaveProperty('src', 'https://cdn.example/old.jpg');

    fireEvent.click(within(dialog).getByRole('button', { name: /remove/i }));
    fireEvent.click(within(dialog).getByRole('button', { name: /save changes/i }));

    await waitFor(() =>
      expect(updateProduct).toHaveBeenCalledWith('p1', expect.objectContaining({ imageUrl: null })),
    );
  });
});

describe('EventCataloguePanel barcode photo decode', () => {
  it('keeps what was typed elsewhere while a barcode photo is still decoding', async () => {
    // BarcodeField.onPhoto calls accept() (which calls onChange) after an
    // await, same trap as the image upload above: setForm({ ...form,
    // barcode }) at this call site captures a stale `form`, so anything
    // typed into another field while the photo is decoding is thrown away
    // the moment the decode resolves.
    let resolveDecode!: (result: { getText: () => string }) => void;
    decodeFromImageUrl.mockReturnValue(new Promise((resolve) => { resolveDecode = resolve; }));
    await renderCataloguePanel();
    const dialog = await openAddProductDialog();

    const file = new File([new Uint8Array([1])], 'barcode.png', { type: 'image/png' });
    fireEvent.change(within(dialog).getByTestId('barcode-photo-input'), { target: { files: [file] } });

    // Type into the name field WHILE the barcode photo is still decoding.
    fireEvent.change(within(dialog).getByPlaceholderText('Castle Lite 330ml'), {
      target: { value: 'Test Product' },
    });

    await act(async () => { resolveDecode({ getText: () => '6001240100015' }); });
    await within(dialog).findByDisplayValue('6001240100015');

    expect(within(dialog).getByDisplayValue('Test Product')).toBeTruthy();
  });
});
