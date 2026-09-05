# Easier product and menu entry — dashboard implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop making organizers hand-type things the browser can capture: scan or photograph a barcode, upload an image instead of hosting one, and pick a category instead of retyping it.

**Architecture:** Four self-contained changes to two existing forms. The category picker and the barcode field are pure dashboard work with no server involvement. The two image fields post to the media endpoints from the API plan and then save the returned URL through the create/update calls that already accept `imageUrl`.

**Tech Stack:** React 19 + TypeScript, TanStack Query, shadcn/ui, Tailwind, Vitest + Testing Library (jsdom), `@zxing/browser`.

**Spec:** `../api-stockgrant-wt/docs/superpowers/specs/2026-09-05-menu-and-catalogue-entry-design.md`

## Prerequisite

Tasks 3 and 4 post to `POST /api/media/events/:eventId/menu-item` and `/product`, which ship in `../api-stockgrant-wt/docs/superpowers/plans/2026-09-05-item-image-upload-api.md`. **That must be deployed to prod before those two tasks can be verified.** Tasks 1 and 2 have no such dependency and can run immediately.

## Global Constraints

- **Typing always still works.** Every one of these fields keeps its manual path: a barcode can be typed, a category can be created, an image can be left empty. Scanning and uploading are additions, never replacements — a laptop with no camera must behave exactly as it does today.
- **No silent fallbacks.** A denied camera, a decode that finds nothing, and a rejected upload each say what happened. None of them clears what the organizer already entered.
- **Uploads bypass `apiClient.request`.** That helper hard-sets `Content-Type: application/json` (`src/lib/api.ts:94`), which breaks multipart — the browser must set its own boundary. Copy the existing `uploadPoster` pattern (`src/lib/api.ts:529-550`): raw `fetch`, `FormData`, and only the `Authorization` / `x-api-key` headers.
- **No new dependency except `@zxing/browser`.** In particular do not add `cmdk` for the category picker; the repo has `@radix-ui/react-popover` but no `command.tsx`, and a `<Select>` with an escape hatch is enough.
- Run tests with `npx vitest run <path>` from the worktree root. Full suite: `npm test`.
- `node_modules` here is a real local install (not the shared symlink) because the shared tree is missing `react-easy-crop`. Leave it alone; never `git clean -xfd` or `git stash push -u`.

---

### Task 1: Category becomes a picker

**Files:**
- Modify: `src/components/EventMenuTab.tsx` (the category field at ~`:465-473`)
- Test: `src/components/__tests__/EventMenuTabCategory.test.tsx` (create)

**Interfaces:**
- Consumes: the existing `categoryOptions` memo (~`:111`), which already collects every category used on this event's menu.
- Produces: a category control that lists existing categories and offers **"+ New category…"**, which reveals a text input.

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/EventMenuTabCategory.test.tsx`, mocking the API client the way `src/components/__tests__/StallOperatorsPanel.test.tsx` does — read that file first for the `vi.mock` shape, the `QueryClientProvider` wrapper and its `ResizeObserver` polyfill, and reuse them.

```tsx
// The point of this change is discoverability: the old control was an
// <Input list=…> datalist, which looks identical to a plain text box, so
// nobody found the suggestions and menus grew "Drinks" next to "drinks".
it('offers the categories already used on this event', async () => {
  await renderMenuTabWithItems([
    { category: 'Starters', section: 'vendor', name: 'Wings' },
    { category: 'Mains', section: 'vendor', name: 'Burger' },
  ]);
  await openAddItemDialog();

  fireEvent.click(await screen.findByRole('combobox', { name: /category/i }));

  expect(await screen.findByRole('option', { name: 'Starters' })).toBeTruthy();
  expect(screen.getByRole('option', { name: 'Mains' })).toBeTruthy();
});

it('lets a new category be created inline, and saves what was typed', async () => {
  await renderMenuTabWithItems([{ category: 'Starters', section: 'vendor', name: 'Wings' }]);
  await openAddItemDialog();

  fireEvent.click(await screen.findByRole('combobox', { name: /category/i }));
  fireEvent.click(await screen.findByRole('option', { name: /new category/i }));

  const input = await screen.findByPlaceholderText(/cold drinks/i);
  fireEvent.change(input, { target: { value: 'Braai Platters' } });
  await fillRequiredFieldsAndSubmit();

  await waitFor(() =>
    expect(createItem).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'Braai Platters' }),
    ),
  );
});

it('saves an existing category without inventing a new one', async () => {
  await renderMenuTabWithItems([{ category: 'Starters', section: 'vendor', name: 'Wings' }]);
  await openAddItemDialog();

  fireEvent.click(await screen.findByRole('combobox', { name: /category/i }));
  fireEvent.click(await screen.findByRole('option', { name: 'Starters' }));
  await fillRequiredFieldsAndSubmit();

  await waitFor(() =>
    expect(createItem).toHaveBeenCalledWith(expect.objectContaining({ category: 'Starters' })),
  );
});
```

Three helpers hold the parts that depend on markup — write them at the top of the file against what `EventMenuTab.tsx` actually renders, and adjust the selectors to the component rather than the component to the selectors:

- `renderMenuTabWithItems(items)` — mock `apiClient` so the menu query resolves with `items`, wrap in `QueryClientProvider`, render `<EventMenuTab eventId="e1" />`, and await the first item's name so the list has settled.
- `openAddItemDialog()` — click the add trigger, then `await screen.findByRole('dialog')`.
- `fillRequiredFieldsAndSubmit()` — inside `within(screen.getByRole('dialog'))`, fill the name and price fields and click submit. Scope every dialog query this way: the header trigger and the dialog's submit button may share an accessible name, exactly as they did in `StallOperatorsPanel`, where an unscoped `getByRole('button')` threw on multiple matches.

Read the component before writing them; do not guess the labels.

**Before declaring RED complete, check each test would fail for the right reason.** A test that passes because it never found the control is not a red.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/EventMenuTabCategory.test.tsx`
Expected: FAIL — there is no combobox; the control is a text input.

- [ ] **Step 3: Replace the datalist input**

In `src/components/EventMenuTab.tsx`, swap the category field for a Select plus an inline-create escape hatch. Add one piece of state beside the form state:

```tsx
  // True while the organizer is naming a category that does not exist yet.
  const [newCategory, setNewCategory] = useState(false);
```

and render:

```tsx
            <div className="space-y-1">
              <Label>Category</Label>
              {newCategory ? (
                <div className="flex gap-2">
                  <Input
                    autoFocus
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    placeholder="Cold Drinks"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { setNewCategory(false); setForm({ ...form, category: '' }); }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Select
                  value={form.category}
                  onValueChange={(v) => {
                    if (v === NEW_CATEGORY) { setNewCategory(true); setForm({ ...form, category: '' }); return; }
                    setForm({ ...form, category: v });
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Pick a category" /></SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    <SelectItem value={NEW_CATEGORY}>+ New category…</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
```

with a module-level sentinel that cannot collide with a real category:

```tsx
/** Sentinel for the "create one" row. A real category is never this. */
const NEW_CATEGORY = '__new__';
```

When editing an existing item whose category is not in `categoryOptions` (it will be, since the options are derived from the items — but a race or a just-deleted last item could leave it absent), start in create mode so the value is never silently dropped: set `newCategory` in the same place `startEdit` populates the form.

Leave the `<datalist id="menu-category-options">` element in place only if the import dialog still uses it; the main form no longer does. Check `:514` and delete it if it has become dead.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/components/__tests__/EventMenuTabCategory.test.tsx && npx tsc --noEmit`
Expected: PASS, tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/EventMenuTab.tsx src/components/__tests__/EventMenuTabCategory.test.tsx
git commit -m "feat(menu): pick a category instead of retyping it"
```

---

### Task 2: Barcode — scan it or photograph it

**Files:**
- Create: `src/components/BarcodeField.tsx`
- Modify: `package.json` (add `@zxing/browser`)
- Modify: `src/components/cashless/EventCataloguePanel.tsx` (the barcode field at ~`:429-432`)
- Test: `src/components/__tests__/BarcodeField.test.tsx` (create)

**Interfaces:**
- Produces: `<BarcodeField value={string} onChange={(v: string) => void} />` — a text input plus, where the device allows, a Scan button and a Photo button.

- [ ] **Step 1: Add the dependency**

Run: `npm install @zxing/browser`
It brings `@zxing/library` as a peer. Commit the lockfile change with the task.

- [ ] **Step 2: Write the failing test**

Create `src/components/__tests__/BarcodeField.test.tsx`. jsdom has no camera and no real decoder, so stub both and assert the component's behaviour around them:

```tsx
// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { BarcodeField } from '@/components/BarcodeField';

const decodeFromImageElement = vi.fn();
const decodeFromVideoDevice = vi.fn();

vi.mock('@zxing/browser', () => ({
  BrowserMultiFormatReader: class {
    decodeFromImageElement = decodeFromImageElement;
    decodeFromVideoDevice = decodeFromVideoDevice;
    reset = vi.fn();
  },
}));

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
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/BarcodeField.test.tsx`
Expected: FAIL — the component does not exist.

- [ ] **Step 4: Build the component**

Create `src/components/BarcodeField.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * A barcode input that can also be filled by the camera.
 *
 * The text input is always present and always the source of truth — a laptop
 * with no webcam, or any page not on HTTPS (browsers gate getUserMedia on a
 * secure context), sees exactly the field that existed before this component.
 * Scanning and photo decoding only ever WRITE into it; no failure path clears
 * what the organizer typed.
 */
export function BarcodeField({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);

  const hasCamera =
    typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

  const reader = () => (readerRef.current ??= new BrowserMultiFormatReader());

  // A camera left running after the dialog closes is a lit LED and a battery
  // drain the organizer cannot explain, so stop it on the way out.
  useEffect(() => () => { readerRef.current?.reset(); }, []);

  const accept = (text: string) => {
    setMessage(null);
    setScanning(false);
    readerRef.current?.reset();
    onChange(text);
  };

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    setMessage(null);
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const result = await reader().decodeFromImageElement(img);
      accept(result.getText());
    } catch {
      // Distinguishing "no barcode in this photo" from a broken component is
      // the whole point — a silent no-op here reads as the button not working.
      setMessage('No barcode found in that image. Try again, or type it.');
    } finally {
      URL.revokeObjectURL(url);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const startScan = async () => {
    setMessage(null);
    setScanning(true);
    try {
      await reader().decodeFromVideoDevice(undefined, videoRef.current!, (result) => {
        if (result) accept(result.getText());
      });
    } catch (err: any) {
      setScanning(false);
      setMessage(
        err?.name === 'NotAllowedError'
          ? 'Camera blocked. Allow camera access, or use a photo.'
          : 'Could not start the camera. Use a photo, or type the barcode.',
      );
    }
  };

  const stopScan = () => {
    readerRef.current?.reset();
    setScanning(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => { setMessage(null); onChange(e.target.value); }}
          placeholder="6001240100015"
        />
        {hasCamera && (
          <Button type="button" variant="outline" onClick={scanning ? stopScan : startScan}>
            {scanning ? 'Stop' : 'Scan'}
          </Button>
        )}
        <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
          Photo
        </Button>
        <input
          ref={fileRef}
          data-testid="barcode-photo-input"
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => onPhoto(e.target.files?.[0])}
        />
      </div>

      {scanning && (
        <video ref={videoRef} className="w-full rounded-md border" muted playsInline />
      )}

      {message && <p className="text-xs text-red-600">{message}</p>}
    </div>
  );
}
```

Two details to verify against the installed version as you write it, and adjust rather than assume: `decodeFromVideoDevice`'s signature (older ZXing builds take `(deviceId, videoElement, callback)`; newer `@zxing/browser` exposes `decodeFromVideoDevice` returning controls with a `stop()` instead of `reader.reset()`), and whether `reset` exists on the reader you get. Match the installed API — the tests stub both `reset` and the two decode methods, so update the stub if the real shape differs.

- [ ] **Step 5: Use it in the catalogue form**

In `src/components/cashless/EventCataloguePanel.tsx`, replace the barcode `<Input>` (~`:430`) with:

```tsx
              <BarcodeField
                value={form.barcode}
                onChange={(barcode) => setForm({ ...form, barcode })}
              />
```

keeping the surrounding `<Label>Barcode <span…>(optional, EAN/UPC)</span></Label>` exactly as it is. The existing validation at `:222` and the API's duplicate-barcode 400 are untouched.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run src/components/__tests__/BarcodeField.test.tsx && npx tsc --noEmit`
Expected: PASS, tsc clean.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/components/BarcodeField.tsx src/components/cashless/EventCataloguePanel.tsx src/components/__tests__/BarcodeField.test.tsx
git commit -m "feat(catalogue): scan or photograph a barcode instead of typing it"
```

---

### Task 3: Upload a menu item image

**REQUIRES** the API plan deployed to prod.

**Files:**
- Create: `src/components/ImageUploadField.tsx`
- Modify: `src/lib/api.ts` (an `uploadMenuItemImage` client method)
- Modify: `src/components/EventMenuTab.tsx` (the Image URL field at ~`:486-492`)
- Test: `src/components/__tests__/ImageUploadField.test.tsx` (create)

**Interfaces:**
- Produces: `<ImageUploadField value={string} onChange={(url: string) => void} onUpload={(file: File) => Promise<string>} />` — a preview, a Choose-image button, and a Remove button.
- Produces: `apiClient.media.uploadMenuItemImage(eventId, file): Promise<string>` returning the URL.

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/ImageUploadField.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/ImageUploadField.test.tsx`
Expected: FAIL — the component does not exist.

- [ ] **Step 3: Build the field**

Create `src/components/ImageUploadField.tsx`. It performs no fetch of its own — the caller supplies `onUpload`, which keeps it testable and lets Task 4 reuse it for products against a different endpoint:

```tsx
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Choose an image, hand the file to the caller's uploader, and report the URL
 * it returns. Deliberately ignorant of endpoints: the menu form and the
 * catalogue form pass different uploaders.
 *
 * A failed upload leaves `value` alone. An organizer replacing the photo on a
 * saved item must not lose the photo that is already live because the new one
 * was too large.
 */
export function ImageUploadField({
  value,
  onChange,
  onUpload,
}: {
  value: string;
  onChange: (url: string) => void;
  onUpload: (file: File) => Promise<string>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const choose = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await onUpload(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {value && <img src={value} alt="" className="h-16 w-16 rounded-md object-cover" />}
        <Button type="button" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? 'Uploading…' : value ? 'Replace image' : 'Choose image'}
        </Button>
        {value && !busy && (
          <Button type="button" variant="ghost" onClick={() => { setError(null); onChange(''); }}>
            Remove
          </Button>
        )}
        <input
          ref={fileRef}
          data-testid="image-upload-input"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => choose(e.target.files?.[0])}
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Add the client method**

In `src/lib/api.ts`, beside the existing `uploadPoster` (`:529`), copying its shape exactly — raw `fetch`, `FormData`, auth headers only, no `Content-Type`:

```ts
    uploadMenuItemImage: async (eventId: string, file: File): Promise<string> => {
      const formData = new FormData();
      formData.append('image', file);

      const token = this.getToken();
      const uploadHeaders: Record<string, string> = {};
      if (token) uploadHeaders['Authorization'] = `Bearer ${token}`;
      if (APP_API_KEY) uploadHeaders['x-api-key'] = APP_API_KEY;
      const response = await fetch(`${this.baseUrl}/media/events/${eventId}/menu-item`, {
        method: 'POST',
        headers: uploadHeaders,
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Upload failed' }));
        throw new Error(error.message || 'Failed to upload image');
      }

      const data = await response.json();
      return data.data.media.url;
    },
```

Place it under whichever namespace `uploadPoster` lives in, following that file's structure rather than inventing a new `media` namespace if one does not exist.

- [ ] **Step 5: Use it in the menu form**

Replace the Image URL input (~`:487-491`) with:

```tsx
            <div className="space-y-1">
              <Label>Image <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <ImageUploadField
                value={form.imageUrl}
                onChange={(imageUrl) => setForm({ ...form, imageUrl })}
                onUpload={(file) => apiClient.events.uploadMenuItemImage(eventId, file)}
              />
            </div>
```

`imageUrl` still travels to the API through the existing save call — nothing about the mutation changes.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run src/components/__tests__/ImageUploadField.test.tsx && npx tsc --noEmit`
Expected: PASS, tsc clean.

- [ ] **Step 7: Commit**

```bash
git add src/components/ImageUploadField.tsx src/lib/api.ts src/components/EventMenuTab.tsx src/components/__tests__/ImageUploadField.test.tsx
git commit -m "feat(menu): upload an item image instead of pasting a url"
```

---

### Task 4: Give catalogue products an image

**REQUIRES** the API plan deployed to prod.

**Files:**
- Modify: `src/lib/api.ts` (an `uploadProductImage` client method)
- Modify: `src/components/cashless/EventCataloguePanel.tsx` (new image field + send `imageUrl`)
- Test: `src/components/__tests__/EventCatalogueImage.test.tsx` (create)

**Interfaces:**
- Consumes: `ImageUploadField` (Task 3).
- Produces: `apiClient.…uploadProductImage(eventId, file): Promise<string>`; the catalogue form's create and update calls carry `imageUrl`.

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/EventCatalogueImage.test.tsx`, mocking the client as the sibling suites do:

```tsx
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

it('omits imageUrl entirely when no image was chosen', async () => {
  await renderCataloguePanel();
  await openAddProductDialog();
  await fillRequiredFieldsAndSubmit();

  // The API validates imageUrl as a URI; sending '' would be a 400.
  const [, payload] = createProduct.mock.calls[0];
  expect(payload.imageUrl).toBeUndefined();
});
```

That second test guards a real trap: `createProductSchema` validates `imageUrl` with `Joi.string().uri()`, so an empty string is a validation error, not an absent value. Match how the form already conditionally spreads `barcode` (`:252`) and do the same for `imageUrl`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/EventCatalogueImage.test.tsx`
Expected: FAIL — there is no image control in the product dialog.

- [ ] **Step 3: Add the client method**

Copy `uploadMenuItemImage` from Task 3, changing the path segment to `/product` and the error text.

- [ ] **Step 4: Add the field and send the value**

Add `imageUrl: ''` to the form's `EMPTY` (`:45`), populate it in `startEdit` (`:207`) from `p.imageUrl ?? ''`, render an `<ImageUploadField>` in the product dialog with `onUpload={(file) => apiClient.…uploadProductImage(eventId, file)}`, and include it in both the create and update payloads the same way `barcode` is handled — spread conditionally on create, and send `null` on update when cleared, matching how `updateProductSchema` allows `null`.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/components/__tests__/ && npx tsc --noEmit`
Expected: PASS, tsc clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/api.ts src/components/cashless/EventCataloguePanel.tsx src/components/__tests__/EventCatalogueImage.test.tsx
git commit -m "feat(catalogue): give products an image"
```

---

### Task 5: Verify and ship

**Files:** none — verification only.

- [ ] **Step 1: Typecheck, lint, build, suite**

Run `npx tsc --noEmit`, then eslint over this branch's changed files only (the repo carries pre-existing errors — compare against `origin/main` rather than treating the total as yours), then `npm run build`, then `npm test`.
Expected: tsc clean, no new lint errors, build clean, suite green.

- [ ] **Step 2: Exercise the camera path once by hand**

The scanner cannot be verified in jsdom. Before shipping, open the catalogue form on a device with a camera over HTTPS, scan one real barcode, and confirm the field fills. Also confirm the Scan button is absent on a machine without a camera. Record what you tested in your report — this is the one part of the plan tests cannot cover.

- [ ] **Step 3: Land**

Pages is git-connected: `keshless-tickets-admin` builds `main` → manage.carrottickets.com, `carrot-tickets-admin-dev` builds `dev`.

```bash
git fetch origin
git rev-list --count HEAD..origin/main   # must be 0
git push origin <branch>:dev             # verify on dev-manage first — this slice is all UI
git push origin <branch>:main
```

- [ ] **Step 4: Verify the deploy**

Pages lives on the **contracts** Cloudflare account (`9f074c8dd70baaa27e08c1602bdec69a`), token `CONTRACTS_CLOUDFLARE__API_TOKEN` in Secret Manager project `contracts-470406`; that account rejects `per_page`, so page with `?page=N`:

```
GET /accounts/<id>/pages/projects/keshless-tickets-admin/deployments?page=1
```

Then confirm the live bundle carries the change: fetch `https://manage.carrottickets.com/`, find the `/assets/index-*.js` bundle, and grep it for a string only this branch introduces.

---

## What this plan does NOT cover

- The upload endpoints themselves (`../api-stockgrant-wt/docs/superpowers/plans/2026-09-05-item-image-upload-api.md`).
- The vendor picker on the menu, and the event-vendor entity behind it — deferred by the spec's Non-goals, because the system has no list of third-party vendors to pick from and pointing menu items at a cashless `Merchant` would conflate them with the organizer's own stalls.
