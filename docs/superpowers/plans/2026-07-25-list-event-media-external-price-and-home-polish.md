# List-event media + external price, and home-page polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let organizers add a poster + gallery and an external price (with E/R currency) right in the create-event modal, surface that price on cards, and apply three home-page/nav tweaks.

**Architecture:** Three repos, in order. **api** gains three Event fields (`currency`, `priceMin`, `priceMax`) validated by Joi and echoed through the public serializer. **dashboard**'s create modal captures media (deferred `File`s previewed locally, uploaded after the event is created — a two-phase submit) plus an external price/currency, extracted into a testable `submitNewEvent` orchestrator. **website** renders the external price on the card and gets the three polish edits.

**Tech Stack:** TypeScript throughout. api = Express + Mongoose + Joi, tests via Jest + `mongodb-memory-server`. dashboard + website = React + Vite + React Query, tests via Vitest + Testing Library.

## Global Constraints

- **Currency values:** exactly `'SZL'` and `'ZAR'`. Display symbol: `SZL → 'E'`, `'ZAR' → 'R'`. Default `'SZL'`.
- **Currency is display-only** for events Carrot does NOT sell. Do NOT touch ticket-tier prices, checkout, MoMo/card, POS, or payouts. Carrot-sold card prices stay literal `'E'`.
- **No silent fallbacks** (global rule): if media upload fails after the event is created, surface the error loudly and keep the event. Never fabricate a placeholder image or swallow the error.
- **No new backward-compat shims.** The `GalleryManager` change is an *additive optional prop* only — existing callers keep working unchanged.
- **Price fields are only sent for `ticketing === 'external'`** from the dashboard. The API tolerates but ignores them for carrot events.
- **Repos & branches:** `carrot-tickets-api` (`main`), `carrot-tickets-dashboard` (`main`), `carrot-tickets-website` = local `landing/` (`master`).
- **Commit after each task.** Do not push (user pushes/deploys separately).
- Run commands from each repo root: api = `~/Documents/omevision/contracts/carrot-tickets/api`, dashboard = `.../dashboard`, website = `.../landing`.

---

## PHASE 1 — api (`carrot-tickets-api`)

### Task 1: Joi validation for currency + price range

**Files:**
- Modify: `src/validators/tickets.validator.ts` (`createEventSchema` ends line 217; `updateEventSchema` lines 219–257)
- Test: `src/validators/__tests__/eventPricing.validator.test.ts` (create)

**Interfaces:**
- Produces: `createEventSchema` / `updateEventSchema` now accept `currency: 'SZL'|'ZAR'` (create defaults `'SZL'`), `priceMin?: number>=0`, `priceMax?: number>=0`, and reject `priceMax < priceMin`.

- [ ] **Step 1: Write the failing test** — `src/validators/__tests__/eventPricing.validator.test.ts`

```ts
import { createEventSchema, updateEventSchema } from '@validators/tickets.validator';

const base = {
  name: 'E', venue: 'V',
  eventDate: new Date(Date.now() + 8.64e7),
  startTime: new Date(Date.now() + 8.64e7),
  endTime: new Date(Date.now() + 9e7),
};

it('defaults currency to SZL on create', () => {
  const { value } = createEventSchema.validate({ ...base });
  expect(value.currency).toBe('SZL');
});

it('accepts ZAR + a valid min/max range', () => {
  const { error, value } = createEventSchema.validate({
    ...base, ticketing: 'external', externalTicketUrl: 'https://x.co/t',
    currency: 'ZAR', priceMin: 100, priceMax: 250,
  });
  expect(error).toBeUndefined();
  expect(value.currency).toBe('ZAR');
  expect(value.priceMin).toBe(100);
  expect(value.priceMax).toBe(250);
});

it('rejects an unknown currency', () => {
  const { error } = createEventSchema.validate({ ...base, currency: 'USD' });
  expect(error).toBeDefined();
});

it('rejects priceMax below priceMin', () => {
  const { error } = createEventSchema.validate({ ...base, priceMin: 300, priceMax: 100 });
  expect(error).toBeDefined();
  expect(error!.details[0].message).toMatch(/maximum price/i);
});

it('allows a lone priceMin (open-ended "from")', () => {
  const { error } = createEventSchema.validate({ ...base, priceMin: 100 });
  expect(error).toBeUndefined();
});

it('validates the same range rule on update', () => {
  const { error } = updateEventSchema.validate({ priceMin: 300, priceMax: 100 });
  expect(error).toBeDefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/validators/__tests__/eventPricing.validator.test.ts`
Expected: FAIL (currency undefined / range not enforced).

- [ ] **Step 3: Add the fields + range check to both schemas**

At the top of `src/validators/tickets.validator.ts` (after imports), add the shared reusable check:

```ts
// Cross-field guard: a max price, when both are present, must be >= the min.
const priceRangeCheck = (value: any, helpers: any) => {
  if (value.priceMin != null && value.priceMax != null && value.priceMax < value.priceMin) {
    return helpers.message('Maximum price must be greater than or equal to minimum price');
  }
  return value;
};
```

In `createEventSchema`, add these keys inside the object (next to `externalTicketUrl`, before the closing `});` at line 217):

```ts
  currency: Joi.string().valid('SZL', 'ZAR').default('SZL').messages({
    'any.only': "Currency must be either 'SZL' or 'ZAR'",
  }),
  priceMin: Joi.number().min(0).optional(),
  priceMax: Joi.number().min(0).optional(),
```

Then change the create schema's closing from `});` to:

```ts
}).custom(priceRangeCheck);
```

In `updateEventSchema`, add the same three keys (but `currency` optional, no default):

```ts
  currency: Joi.string().valid('SZL', 'ZAR').optional().messages({
    'any.only': "Currency must be either 'SZL' or 'ZAR'",
  }),
  priceMin: Joi.number().min(0).optional(),
  priceMax: Joi.number().min(0).optional(),
```

The update schema currently ends `}).min(1).messages({ 'object.min': ... });`. Add `.custom(priceRangeCheck)` after `.min(1)`:

```ts
}).min(1).custom(priceRangeCheck).messages({
  'object.min': 'At least one field must be provided for update'
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/validators/__tests__/eventPricing.validator.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/validators/tickets.validator.ts src/validators/__tests__/eventPricing.validator.test.ts
git commit -m "feat(events): validate currency + price range on create/update"
```

---

### Task 2: Persist currency + price on the Event model & service

**Files:**
- Modify: `src/interfaces/event.interface.ts` (add to `IEvent`, near `externalTicketUrl` ~line 60)
- Modify: `src/models/event.model.ts` (add to `eventSchema`, near the ticketing block ~line 140)
- Modify: `src/services/event.service.ts` (`CreateEventParams` ~8–27, `UpdateEventParams` ~29–47, `createEvent` `new Event({...})` ~71–83, `updateEvent` assignments ~285–286)
- Test: `src/services/__tests__/eventPricing.service.test.ts` (create)

**Interfaces:**
- Consumes: nothing new.
- Produces: `EventService.createEvent`/`updateEvent` accept + persist `currency: 'SZL'|'ZAR'` (defaults `'SZL'`), `priceMin?: number`, `priceMax?: number`.

- [ ] **Step 1: Write the failing test** — `src/services/__tests__/eventPricing.service.test.ts`

```ts
import { connectTestDb, clearTestDb, disconnectTestDb } from '../../__tests__/helpers/mongo';
import { EventService } from '@services/event.service';

describe('EventService pricing passthrough', () => {
  beforeAll(connectTestDb); afterEach(clearTestDb); afterAll(disconnectTestDb);

  const base = {
    vendorId: '507f1f77bcf86cd799439011', name: 'X', venue: 'V',
    eventDate: new Date(), startTime: new Date(), endTime: new Date(), ticketTypes: [],
  };

  it('persists currency + price range on create', async () => {
    const e = await EventService.createEvent({
      ...base, ticketing: 'external', externalTicketUrl: 'https://x.co/t',
      currency: 'ZAR', priceMin: 100, priceMax: 250,
    } as any);
    expect(e.currency).toBe('ZAR');
    expect(e.priceMin).toBe(100);
    expect(e.priceMax).toBe(250);
  });

  it('defaults currency to SZL when not specified', async () => {
    const e = await EventService.createEvent({ ...base } as any);
    expect(e.currency).toBe('SZL');
  });

  it('updates the price range', async () => {
    const created = await EventService.createEvent({ ...base } as any);
    const updated = await EventService.updateEvent(
      (created as any)._id.toString(), base.vendorId,
      { currency: 'ZAR', priceMin: 50, priceMax: 75 } as any, false,
    );
    expect(updated!.currency).toBe('ZAR');
    expect(updated!.priceMin).toBe(50);
    expect(updated!.priceMax).toBe(75);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/services/__tests__/eventPricing.service.test.ts`
Expected: FAIL (fields undefined / not on model).

- [ ] **Step 3: Add the fields**

`src/interfaces/event.interface.ts` — add after `externalTicketUrl?: string;` (~line 60):

```ts
  // Display currency for the event price. 'SZL' shows 'E', 'ZAR' shows 'R'.
  // Only meaningful for external events (Carrot-sold prices are always E).
  currency: 'SZL' | 'ZAR';
  // Organizer-entered display price range for external events (Carrot isn't
  // selling, so there are no ticket tiers to derive a range from).
  priceMin?: number;
  priceMax?: number;
```

`src/models/event.model.ts` — add inside `eventSchema`, right after the `externalTicketUrl` field (~line 140):

```ts
  currency: {
    type: String,
    enum: ['SZL', 'ZAR'],
    default: 'SZL'
  },
  priceMin: {
    type: Number,
    min: [0, 'Price cannot be negative']
  },
  priceMax: {
    type: Number,
    min: [0, 'Price cannot be negative']
  },
```

`src/services/event.service.ts` — in `CreateEventParams` (after `externalTicketUrl?: string;` ~line 26) AND `UpdateEventParams` (after `externalTicketUrl?: string;` ~line 46), add:

```ts
  currency?: 'SZL' | 'ZAR';
  priceMin?: number;
  priceMax?: number;
```

In `createEvent`'s `new Event({...})` (after `externalTicketUrl: params.externalTicketUrl,` ~line 83):

```ts
        currency: params.currency ?? 'SZL',
        priceMin: params.priceMin,
        priceMax: params.priceMax,
```

In `updateEvent` (after the `externalTicketUrl` assignment ~line 286):

```ts
      if (updates.currency) event.currency = updates.currency;
      if (updates.priceMin !== undefined) event.priceMin = updates.priceMin;
      if (updates.priceMax !== undefined) event.priceMax = updates.priceMax;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/services/__tests__/eventPricing.service.test.ts`
Expected: PASS (3 tests). Also run `npx tsc --noEmit` — expect no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/interfaces/event.interface.ts src/models/event.model.ts src/services/event.service.ts src/services/__tests__/eventPricing.service.test.ts
git commit -m "feat(events): persist currency + price range on the event model"
```

---

### Task 3: Emit the new fields (+ galleryImages) from the public serializer & list query

**Files:**
- Modify: `src/utils/eventCard.util.ts` (`buildEventCardFields` ~14–51)
- Modify: `src/controllers/public.controller.ts` (`getPublicEvents` `.select(...)` line 232)
- Test: `src/utils/__tests__/eventCard.util.test.ts` (extend existing)

**Interfaces:**
- Consumes: Event docs now carrying `currency`/`priceMin`/`priceMax` (Task 2).
- Produces: `buildEventCardFields(event)` includes `currency` (default `'SZL'`), `priceMin` (or `null`), `priceMax` (or `null`), `galleryImages` (or `[]`). These flow to `/public/events` list + single + feed slides.

**Why galleryImages too:** `EventMasonry` on the website cycles `event.galleryImages`, but the list query never returned them (its `.select()` omits the field), so the animation had nothing to cycle. Emitting them here is the payoff for capturing a gallery in Task 8.

- [ ] **Step 1: Write the failing test** — append to `src/utils/__tests__/eventCard.util.test.ts`

```ts
import { buildEventCardFields } from '@/utils/eventCard.util';

describe('buildEventCardFields — currency + external price + gallery', () => {
  it('defaults currency to SZL and price/gallery to null/[] when absent', () => {
    const f = buildEventCardFields({ name: 'A', ticketTypes: [] });
    expect(f.currency).toBe('SZL');
    expect(f.priceMin).toBeNull();
    expect(f.priceMax).toBeNull();
    expect(f.galleryImages).toEqual([]);
  });

  it('passes through ZAR + explicit price range + gallery', () => {
    const f = buildEventCardFields({
      name: 'B', ticketTypes: [], currency: 'ZAR',
      priceMin: 100, priceMax: 250, galleryImages: ['a.jpg', 'b.jpg'],
    });
    expect(f.currency).toBe('ZAR');
    expect(f.priceMin).toBe(100);
    expect(f.priceMax).toBe(250);
    expect(f.galleryImages).toEqual(['a.jpg', 'b.jpg']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/utils/__tests__/eventCard.util.test.ts`
Expected: FAIL (fields undefined). The existing parity test (`eventCardParity.test.ts`) may also start failing — that is expected; Step 3's single-source change fixes both.

- [ ] **Step 3: Add the fields to `buildEventCardFields`**

In `src/utils/eventCard.util.ts`, inside the returned object (after the `externalTicketUrl:` line ~44, before `category:`), add:

```ts
    // Display currency + organizer-entered price range for external events.
    // Legacy events predating these fields fall back to SZL / no range.
    currency: event.currency ?? 'SZL',
    priceMin: event.priceMin ?? null,
    priceMax: event.priceMax ?? null,
    // Gallery images power the website's auto-cycling masonry/card animation.
    // Absent on legacy events or under a .select() that omits them → [].
    galleryImages: event.galleryImages ?? [],
```

- [ ] **Step 4: Add the fields to the list-query projection**

In `src/controllers/public.controller.ts` line 232, extend the `.select('...')` string by appending ` priceMin priceMax currency galleryImages` (keep every existing field):

```ts
          .select('name description venue eventDate startTime endTime posterUrl thumbnailUrl ticketTypes capacity totalTicketsSold vendorId likeCount ticketing externalTicketUrl category priceMin priceMax currency galleryImages')
```

(`getPublicEvent` for a single event uses `.lean()` with no projection, so it already returns these — no change there.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest src/utils/__tests__/eventCard.util.test.ts src/utils/__tests__/eventCardParity.test.ts`
Expected: PASS (new tests + parity test green again).

- [ ] **Step 6: Commit**

```bash
git add src/utils/eventCard.util.ts src/controllers/public.controller.ts src/utils/__tests__/eventCard.util.test.ts
git commit -m "feat(events): expose currency, price range, and gallery on public event cards"
```

---

## PHASE 2 — dashboard (`carrot-tickets-dashboard`)

### Task 4: Currency helper + type fields

**Files:**
- Create: `src/lib/currency.ts`
- Modify: `src/types/index.ts` (`Event` ~63–93, `EventFormData` ~106–128)
- Test: `src/lib/__tests__/currency.test.ts` (create)

**Interfaces:**
- Produces: `type Currency = 'SZL' | 'ZAR'`; `currencySymbol(c?: Currency | string): 'E' | 'R'`. `Event` + `EventFormData` gain `currency?: Currency`, `priceMin?: number`, `priceMax?: number`.

- [ ] **Step 1: Write the failing test** — `src/lib/__tests__/currency.test.ts`

```ts
import { currencySymbol } from '@/lib/currency';

it("maps ZAR to 'R'", () => expect(currencySymbol('ZAR')).toBe('R'));
it("maps SZL to 'E'", () => expect(currencySymbol('SZL')).toBe('E'));
it("defaults undefined to 'E'", () => expect(currencySymbol(undefined)).toBe('E'));
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/currency.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** — `src/lib/currency.ts`

```ts
// Display currency for event prices. 'SZL' (Lilangeni) shows 'E'; 'ZAR' (Rand)
// shows 'R'. Only used as a DISPLAY label for external events — Carrot never
// charges in anything but Emalangeni.
export type Currency = 'SZL' | 'ZAR';

export function currencySymbol(currency?: Currency | string): 'E' | 'R' {
  return currency === 'ZAR' ? 'R' : 'E';
}
```

Add to `src/types/index.ts` `Event` (after `externalTicketUrl?: string;` line 92):

```ts
  // Display currency + organizer-entered price range for external events.
  currency?: 'SZL' | 'ZAR';
  priceMin?: number;
  priceMax?: number;
```

Add to `EventFormData` (after `externalTicketUrl?: string;` line 127):

```ts
  currency?: 'SZL' | 'ZAR';
  priceMin?: number;
  priceMax?: number;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/currency.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/currency.ts src/lib/__tests__/currency.test.ts src/types/index.ts
git commit -m "feat(events): add currency helper + price/currency form types"
```

---

### Task 5: External-price payload + validation helpers

**Files:**
- Modify: `src/lib/ticketing.ts`
- Test: `src/lib/__tests__/ticketingPrice.test.ts` (create)

**Interfaces:**
- Consumes: `Currency` from `src/lib/currency.ts`, `Ticketing` from this file.
- Produces:
  - `validateExternalPriceRange(min, max): string | null` — error string when `max < min`, else `null`.
  - `buildExternalPricePayload(ticketing, currency, min, max): { currency?, priceMin?, priceMax? }` — `{}` for carrot; for external, `currency` always + numeric `priceMin`/`priceMax` when provided.

- [ ] **Step 1: Write the failing test** — `src/lib/__tests__/ticketingPrice.test.ts`

```ts
import { validateExternalPriceRange, buildExternalPricePayload } from '@/lib/ticketing';

describe('validateExternalPriceRange', () => {
  it('passes when max >= min', () => expect(validateExternalPriceRange('100', '250')).toBeNull());
  it('passes with only a min', () => expect(validateExternalPriceRange('100', '')).toBeNull());
  it('fails when max < min', () => expect(validateExternalPriceRange('300', '100')).toMatch(/maximum/i));
});

describe('buildExternalPricePayload', () => {
  it('returns {} for carrot events', () =>
    expect(buildExternalPricePayload('carrot', 'SZL', '100', '250')).toEqual({}));
  it('returns currency + numeric range for external', () =>
    expect(buildExternalPricePayload('external', 'ZAR', '100', '250'))
      .toEqual({ currency: 'ZAR', priceMin: 100, priceMax: 250 }));
  it('omits empty price fields but keeps currency', () =>
    expect(buildExternalPricePayload('external', 'SZL', '', '')).toEqual({ currency: 'SZL' }));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/ticketingPrice.test.ts`
Expected: FAIL (functions not exported).

- [ ] **Step 3: Implement** — append to `src/lib/ticketing.ts`

```ts
import type { Currency } from '@/lib/currency';

/** Parses a form price string to a number, or undefined when blank/invalid. */
function parsePrice(v: string | number | undefined | null): number | undefined {
  if (v === '' || v == null) return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
}

/**
 * Validates the external price range. Both bounds are optional; only a max
 * below a provided min is an error. Returns a message or null.
 */
export function validateExternalPriceRange(
  priceMin: string | number | undefined | null,
  priceMax: string | number | undefined | null,
): string | null {
  const min = parsePrice(priceMin);
  const max = parsePrice(priceMax);
  if (min != null && max != null && max < min) {
    return 'Maximum price must be greater than or equal to the minimum price.';
  }
  return null;
}

/**
 * Builds the currency/price fields to merge into the event payload. Returns {}
 * for carrot events (price comes from ticket tiers there). For external events
 * always sends the currency label and any numeric bounds provided.
 */
export function buildExternalPricePayload(
  ticketing: Ticketing,
  currency: Currency,
  priceMin: string | number | undefined | null,
  priceMax: string | number | undefined | null,
): { currency?: Currency; priceMin?: number; priceMax?: number } {
  if (ticketing !== 'external') return {};
  const out: { currency?: Currency; priceMin?: number; priceMax?: number } = { currency };
  const min = parsePrice(priceMin);
  const max = parsePrice(priceMax);
  if (min != null) out.priceMin = min;
  if (max != null) out.priceMax = max;
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/ticketingPrice.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ticketing.ts src/lib/__tests__/ticketingPrice.test.ts
git commit -m "feat(events): external price payload + range validation helpers"
```

---

### Task 6: GalleryManager — additive `onNewFilesChange` for deferred use

**Files:**
- Modify: `src/components/GalleryManager.tsx`
- Test: `src/components/__tests__/GalleryManager.test.tsx` (create)

**Interfaces:**
- Produces: `GalleryManager` accepts an optional `onNewFilesChange?: (files: File[]) => void` that fires the full current set of not-yet-uploaded `File`s after every add and every remove. Existing props/behavior unchanged (details page passes `onFilesSelect` only).

- [ ] **Step 1: Write the failing test** — `src/components/__tests__/GalleryManager.test.tsx`

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/GalleryManager.test.tsx`
Expected: FAIL (prop not wired).

- [ ] **Step 3: Implement**

In `src/components/GalleryManager.tsx`:

1. Add `onNewFilesChange` to the props interface (after `onRemove`):

```ts
  onNewFilesChange?: (files: File[]) => void;
```

2. Add it to the destructured params (after `onRemove,`):

```ts
  onNewFilesChange,
```

3. Change the preview state to carry the `File` for new items — replace the `useState` at line 27–29:

```ts
  const [previews, setPreviews] = useState<{ url: string; isNew: boolean; file?: File }[]>(
    currentImages.map(url => ({ url, isNew: false }))
  );
```

4. In `handleFileChange`, capture the file on each new preview — in the `reader.onloadend` push (line 66), change to:

```ts
        newPreviews.push({ url: reader.result as string, isNew: true, file });
```

5. Add an effect that emits the current new-file set whenever previews change — add after the `useState`/`useRef` lines (~line 31):

```ts
  useEffect(() => {
    onNewFilesChange?.(previews.filter(p => p.isNew && p.file).map(p => p.file as File));
    // Intentionally omit onNewFilesChange from deps: callers pass an inline
    // function; re-emitting only when the preview set actually changes is
    // what we want (and avoids a fire loop).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previews]);
```

6. Add `useEffect` to the React import at the top (line 1): `import { useState, useRef, useEffect } from 'react';`

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/__tests__/GalleryManager.test.tsx`
Expected: PASS. Also run the details-page render path if a test exists; no behavior change expected.

- [ ] **Step 5: Commit**

```bash
git add src/components/GalleryManager.tsx src/components/__tests__/GalleryManager.test.tsx
git commit -m "feat(gallery): optional onNewFilesChange for deferred (create-time) use"
```

---

### Task 7: `submitNewEvent` — two-phase create + upload orchestrator

**Files:**
- Create: `src/lib/createEvent.ts`
- Test: `src/lib/__tests__/createEvent.test.ts` (create)

**Interfaces:**
- Consumes: `apiClient.events.createEvent`, `.uploadPoster`, `.uploadGalleryImages`; `EventFormData`, `Event`.
- Produces: `submitNewEvent(data, media): Promise<{ event: Event; uploadError: string | null }>`. Create failure rejects (no event); an upload failure resolves with `uploadError` set and the created event kept.

- [ ] **Step 1: Write the failing test** — `src/lib/__tests__/createEvent.test.ts`

```ts
import { submitNewEvent } from '@/lib/createEvent';
import { apiClient } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  apiClient: { events: {
    createEvent: vi.fn(),
    uploadPoster: vi.fn(),
    uploadGalleryImages: vi.fn(),
  } },
}));

const data = { name: 'E', venue: 'V', eventDate: '2026-08-01', startTime: 's', endTime: 'e', ticketTypes: [] } as any;
const poster = new File(['x'], 'p.png', { type: 'image/png' });
const gallery = [new File(['y'], 'g.png', { type: 'image/png' })];

beforeEach(() => vi.clearAllMocks());

it('creates then uploads poster + gallery to the new event id', async () => {
  (apiClient.events.createEvent as any).mockResolvedValue({ _id: 'ev1' });
  (apiClient.events.uploadPoster as any).mockResolvedValue({});
  (apiClient.events.uploadGalleryImages as any).mockResolvedValue({});

  const res = await submitNewEvent(data, { poster, gallery });

  expect(apiClient.events.createEvent).toHaveBeenCalledWith(data);
  expect(apiClient.events.uploadPoster).toHaveBeenCalledWith('ev1', poster);
  expect(apiClient.events.uploadGalleryImages).toHaveBeenCalledWith('ev1', gallery);
  expect(res).toEqual({ event: { _id: 'ev1' }, uploadError: null });
});

it('keeps the event but reports uploadError when a upload fails', async () => {
  (apiClient.events.createEvent as any).mockResolvedValue({ _id: 'ev2' });
  (apiClient.events.uploadPoster as any).mockRejectedValue(new Error('R2 down'));

  const res = await submitNewEvent(data, { poster, gallery: [] });

  expect(res.event).toEqual({ _id: 'ev2' });
  expect(res.uploadError).toMatch(/R2 down/);
});

it('propagates a create failure (no event, no uploads)', async () => {
  (apiClient.events.createEvent as any).mockRejectedValue(new Error('bad request'));
  await expect(submitNewEvent(data, {})).rejects.toThrow('bad request');
  expect(apiClient.events.uploadPoster).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/createEvent.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** — `src/lib/createEvent.ts`

```ts
import { apiClient } from '@/lib/api';
import type { Event, EventFormData } from '@/types';

export interface NewEventMedia {
  poster?: File | null;
  gallery?: File[];
}

export interface CreateEventResult {
  event: Event;
  uploadError: string | null;
}

/**
 * Two-phase "list an event": create the event, then upload the picked poster +
 * gallery to the returned id (the media endpoints are keyed by eventId, which
 * doesn't exist until the event is created).
 *
 * A create failure rejects — nothing was uploaded. An upload failure does NOT
 * reject: the event already exists, so we keep it and return `uploadError` so
 * the caller can surface a loud "created, but images didn't upload" message
 * (never a silent fallback).
 */
export async function submitNewEvent(
  data: EventFormData,
  media: NewEventMedia,
): Promise<CreateEventResult> {
  const event = await apiClient.events.createEvent(data);
  let uploadError: string | null = null;
  try {
    if (media.poster) {
      await apiClient.events.uploadPoster(event._id, media.poster);
    }
    if (media.gallery && media.gallery.length > 0) {
      await apiClient.events.uploadGalleryImages(event._id, media.gallery);
    }
  } catch (err: any) {
    uploadError = err?.message || 'Image upload failed';
  }
  return { event, uploadError };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/createEvent.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/createEvent.ts src/lib/__tests__/createEvent.test.ts
git commit -m "feat(events): submitNewEvent two-phase create+upload orchestrator"
```

---

### Task 8: Wire media + external price into the create modal

**Files:**
- Modify: `src/pages/EventsPage.tsx` (imports; state ~60–66; `createMutation` ~76–88; `handleSubmit` ~151–204; modal JSX ~232–328)
- Test: manual (see Step 6) — the orchestration + helpers are unit-tested in Tasks 5–7; this task is UI wiring.

**Interfaces:**
- Consumes: `submitNewEvent` (Task 7), `buildExternalPricePayload` + `validateExternalPriceRange` (Task 5), `currencySymbol`/`Currency` (Task 4), `ImageUploadInput`, `GalleryManager` (with `onNewFilesChange`).

- [ ] **Step 1: Add imports** (top of `EventsPage.tsx`)

```ts
import { ImageUploadInput } from '@/components/ImageUploadInput';
import { GalleryManager } from '@/components/GalleryManager';
import { submitNewEvent } from '@/lib/createEvent';
import { buildExternalPricePayload, validateExternalPriceRange } from '@/lib/ticketing';
import type { Currency } from '@/lib/currency';
```

- [ ] **Step 2: Add state** (after line 66, `ticketUrlError`)

```ts
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [currency, setCurrency] = useState<Currency>('SZL');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [priceError, setPriceError] = useState<string | null>(null);
```

- [ ] **Step 3: Replace `createMutation`** (lines 76–88) with the two-phase version + full reset

```ts
  const resetCreateForm = () => {
    setIsDialogOpen(false);
    setIsMultiDay(false);
    setTicketing(DEFAULT_TICKETING);
    setExternalTicketUrl('');
    setTicketUrlError(null);
    setPosterFile(null);
    setGalleryFiles([]);
    setCurrency('SZL');
    setPriceMin('');
    setPriceMax('');
    setPriceError(null);
  };

  const createMutation = useMutation({
    mutationFn: (vars: { data: EventFormData; poster: File | null; gallery: File[] }) =>
      submitNewEvent(vars.data, { poster: vars.poster, gallery: vars.gallery }),
    onSuccess: ({ uploadError }) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      if (uploadError) {
        toast.error(`Event created, but the images didn't upload: ${uploadError} Add them from the event page.`);
      } else {
        toast.success('Event created successfully');
      }
      resetCreateForm();
    },
    onError: (error: any) => toast.error(error.message || 'Failed to create event'),
  });
```

- [ ] **Step 4: Update `handleSubmit`** — add price validation + pass media. Replace the price/payload section (lines 156–203):

```ts
    const urlError = validateTicketingSelection(ticketing, externalTicketUrl);
    if (urlError) { setTicketUrlError(urlError); return; }
    setTicketUrlError(null);

    const rangeError = ticketing === 'external' ? validateExternalPriceRange(priceMin, priceMax) : null;
    if (rangeError) { setPriceError(rangeError); return; }
    setPriceError(null);

    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const venue = formData.get('venue') as string;

    let eventDate: string; let startTime: string; let endTime: string;
    if (isMultiDay) {
      const startDateTime = formData.get('startDateTime') as string;
      const endDateTime = formData.get('endDateTime') as string;
      eventDate = startDateTime.split('T')[0];
      startTime = startDateTime; endTime = endDateTime;
    } else {
      const eventDateValue = formData.get('eventDate') as string;
      const startTimeValue = formData.get('startTime') as string;
      const endTimeValue = formData.get('endTime') as string;
      eventDate = eventDateValue;
      startTime = `${eventDateValue}T${startTimeValue}`;
      endTime = `${eventDateValue}T${endTimeValue}`;
    }

    const data: EventFormData = {
      name,
      description: description || undefined,
      venue,
      eventDate,
      startTime,
      endTime,
      isMultiDay,
      ticketTypes: [],
      ...buildTicketingPayload(ticketing, externalTicketUrl),
      ...buildExternalPricePayload(ticketing, currency, priceMin, priceMax),
    };

    createMutation.mutate({ data, poster: posterFile, gallery: galleryFiles });
```

- [ ] **Step 5: Add the modal UI**

(a) In the external branch (inside `{ticketing === 'external' && ( ... )}`, after the ticket-link field ~line 262), add the currency + price range:

```tsx
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <select
                  id="currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as Currency)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="SZL">E (SZL)</option>
                  <option value="ZAR">R (ZAR)</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="priceMin">From</Label>
                <Input id="priceMin" type="number" min="0" step="0.01" value={priceMin}
                  onChange={(e) => setPriceMin(e.target.value)} placeholder="100" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="priceMax">To</Label>
                <Input id="priceMax" type="number" min="0" step="0.01" value={priceMax}
                  onChange={(e) => setPriceMax(e.target.value)} placeholder="250" />
              </div>
            </div>
            {priceError && <p className="text-xs text-red-600">{priceError}</p>}
            <p className="text-xs text-slate-500">Shown on the card as a price range, e.g. {currencySymbol(currency)}100 – {currencySymbol(currency)}250. Optional.</p>
```

Add `currencySymbol` to the Task-4 currency import: `import { currencySymbol, type Currency } from '@/lib/currency';` (replace the Step-1 `import type { Currency }` line).

(b) Add a Media block just before the submit button (~line 325). Applies to both carrot and external events:

```tsx
            <div className="space-y-3 rounded-lg border border-slate-200 p-3">
              <div>
                <p className="text-sm font-medium text-slate-900">Poster & photos</p>
                <p className="text-xs text-slate-500">Add a poster and a few event photos — events with images get far more views, and multiple photos animate on the card.</p>
              </div>
              <ImageUploadInput
                label="Event poster"
                onFileSelect={setPosterFile}
                onRemove={() => setPosterFile(null)}
              />
              <GalleryManager
                label="Event photos"
                onFilesSelect={() => {}}
                onRemove={() => {}}
                onNewFilesChange={setGalleryFiles}
              />
            </div>
```

(c) Ensure the dialog body scrolls (the modal is now tall). On the `<DialogContent>` add `className="max-h-[90vh] overflow-y-auto"` (merge with any existing className).

(d) The dialog's `onOpenChange`/close should call `resetCreateForm` so picked files don't leak into the next open. Find the `<Dialog open={isDialogOpen} onOpenChange={...}>` and set `onOpenChange={(open) => (open ? setIsDialogOpen(true) : resetCreateForm())}`.

- [ ] **Step 6: Verify (build + manual)**

Run: `npx tsc --noEmit && npx vitest run` (all dashboard unit tests green).
Manual: `npm run dev`, open the create modal → pick a poster + 2 photos, choose "I sell them myself", set currency R and From/To, submit. Confirm the event is created and (with a running api) images upload; confirm a bad range (To < From) blocks with an inline error.

- [ ] **Step 7: Commit**

```bash
git add src/pages/EventsPage.tsx
git commit -m "feat(events): capture poster, gallery, and external price in the create modal"
```

---

### Task 9: External price + currency on the event details (edit) page

**Files:**
- Modify: `src/pages/EventDetailsPage.tsx` (ticketing edit card — external branch; `updateTicketingMutation`/`handleSaveTicketing` ~118–138)
- Test: manual (mirrors Task 8; the payload/validation helpers are already unit-tested).

**Interfaces:**
- Consumes: `buildExternalPricePayload`, `validateExternalPriceRange`, `Currency`, `currencySymbol`, `apiClient.events.updateEvent`.

- [ ] **Step 1: Add local state** for `currency`/`priceMin`/`priceMax` seeded from the loaded event (`event.currency ?? 'SZL'`, `event.priceMin ?? ''`, `event.priceMax ?? ''`).

- [ ] **Step 2: Render the same currency + From/To fields** as Task 8 (a) inside the external-ticketing edit card, with an inline range error.

- [ ] **Step 3: On save**, validate the range and merge `...buildExternalPricePayload('external', currency, priceMin, priceMax)` into the `updateEvent` payload alongside the existing `ticketing`/`externalTicketUrl` update.

- [ ] **Step 4: Verify** — `npx tsc --noEmit`; manually edit an external event's price and reload to confirm it persisted.

- [ ] **Step 5: Commit**

```bash
git add src/pages/EventDetailsPage.tsx
git commit -m "feat(events): edit external price + currency on the details page"
```

---

## PHASE 3 — website (`carrot-tickets-website`, local `landing/`)

### Task 10: Currency helper + type fields (website)

**Files:**
- Create: `src/lib/currency.ts`
- Modify: `src/types/index.ts` (`Event` ~12–54)
- Test: `src/lib/__tests__/currency.test.ts` (create)

**Interfaces:**
- Produces: `currencySymbol(c?: 'SZL'|'ZAR'|string): 'E'|'R'`. `Event` gains `currency?: 'SZL'|'ZAR'`, `priceMin?: number | null`, `priceMax?: number | null`.

- [ ] **Step 1: Write the failing test** — `src/lib/__tests__/currency.test.ts`

```ts
import { currencySymbol } from '@/lib/currency';
it("maps ZAR to 'R'", () => expect(currencySymbol('ZAR')).toBe('R'));
it("defaults to 'E'", () => expect(currencySymbol(undefined)).toBe('E'));
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/currency.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** — `src/lib/currency.ts` (same body as Task 4). Add to `Event` in `src/types/index.ts` (after `externalTicketUrl?: string | null;` line 53):

```ts
  // Display currency + organizer-entered price range for external events.
  currency?: 'SZL' | 'ZAR';
  priceMin?: number | null;
  priceMax?: number | null;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/currency.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/currency.ts src/lib/__tests__/currency.test.ts src/types/index.ts
git commit -m "feat: currency helper + external price types (website)"
```

(No mapper change needed: `transformEvent` spreads `...event`, so `currency`/`priceMin`/`priceMax` from the API flow through automatically.)

---

### Task 11: Render external price on the event card

**Files:**
- Modify: `src/components/EventCard.tsx` (price computation ~52–56)
- Test: `src/components/__tests__/EventCardPrice.test.tsx` (create)

**Interfaces:**
- Consumes: `currencySymbol` (Task 10), `event.ticketing`/`currency`/`priceMin`/`priceMax`.
- Produces: the card's `priceRange` string — external events use `{sym}{min}`/`{sym}{min} - {sym}{max}`; carrot events keep `E{min}`/`E{min} - E{max}` from tiers.

- [ ] **Step 1: Write the failing test** — `src/components/__tests__/EventCardPrice.test.tsx`

```ts
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EventCard } from '@/components/EventCard';
import type { Event } from '@/types';

function makeEvent(over: Partial<Event>): Event {
  return {
    _id: 'e1', id: 'e1', name: 'Show', description: '', venue: 'V',
    eventDate: '2026-08-01T20:00:00Z', dateTime: '2026-08-01T20:00:00Z',
    ticketTypes: [], isSoldOut: false, priceRange: { min: 0, max: 0 },
    ...over,
  } as Event;
}

const render2 = (e: Event) => render(<MemoryRouter><EventCard event={e} /></MemoryRouter>);

it('shows a ZAR range for an external event', () => {
  render2(makeEvent({ ticketing: 'external', currency: 'ZAR', priceMin: 100, priceMax: 250 }));
  expect(screen.getByText('R100 - R250')).toBeInTheDocument();
});

it('shows a lone-min "from" price', () => {
  render2(makeEvent({ ticketing: 'external', currency: 'SZL', priceMin: 100 }));
  expect(screen.getByText('E100')).toBeInTheDocument();
});

it('keeps E tier pricing for carrot events', () => {
  render2(makeEvent({
    ticketing: 'carrot',
    ticketTypes: [
      { _id: 't1', id: 't1', name: 'GA', price: 100, available: 5, availableQuantity: 5, isSoldOut: false },
      { _id: 't2', id: 't2', name: 'VIP', price: 250, available: 5, availableQuantity: 5, isSoldOut: false },
    ],
  }));
  expect(screen.getByText('E100 - E250')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/EventCardPrice.test.tsx`
Expected: FAIL (external event shows no price today).

- [ ] **Step 3: Implement** — replace the price computation in `src/components/EventCard.tsx` (lines 52–56)

```ts
  // External events (Carrot isn't selling) carry no ticket tiers — their price
  // is an organizer-entered range shown in the event's chosen currency (E/R).
  // Carrot-sold events derive the range from their tiers and are always in E.
  let priceRange: string | null;
  if (event.ticketing === 'external') {
    const sym = currencySymbol(event.currency);
    const min = event.priceMin;
    const max = event.priceMax;
    priceRange =
      min == null ? null
        : max == null || max === min ? `${sym}${min}`
        : `${sym}${min} - ${sym}${max}`;
  } else {
    const ticketPrices = event.ticketTypes.map((t) => t.price);
    const minPrice = ticketPrices.length ? Math.min(...ticketPrices) : null;
    const maxPrice = ticketPrices.length ? Math.max(...ticketPrices) : null;
    priceRange =
      minPrice === null ? null : minPrice === maxPrice ? `E${minPrice}` : `E${minPrice} - E${maxPrice}`;
  }
```

Add the import at the top of the file: `import { currencySymbol } from '@/lib/currency';`

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/__tests__/EventCardPrice.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/EventCard.tsx src/components/__tests__/EventCardPrice.test.tsx
git commit -m "feat: show external event price (E/R range) on the card"
```

---

### Task 12: Home page — remove events grid, repoint CTAs, soften masonry fade

**Files:**
- Modify: `src/pages/HomePage.tsx`

**Interfaces:** none exported; this is a page edit. `events`/`loadEvents` stay (the masonry hero needs them); `isLoading`/`error`/`EventGrid` go.

- [ ] **Step 1: Soften the masonry bottom overlay** — line 73, change `h-44` → `h-24` and `via-background/70` → `via-background/40`:

```tsx
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background via-background/40 to-transparent" />
```

- [ ] **Step 2: Remove the events grid `<section>`** — delete lines 179–218 (the whole `{/* Events Section */}` `<section id="events">…</section>` including its `motion.div` heading and the `error ? … : <EventGrid …>` block).

- [ ] **Step 3: Repoint the two CTAs** — both `<a href="#events">` (the "Explore Events" and "Buy Tickets" buttons, lines 135 and 141) become React Router links to `/discover`:

```tsx
            <Link to="/discover">
              <Button size="lg" className="group w-full gap-2 shadow-sm sm:w-auto">
                Explore Events
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link to="/discover">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                Buy Tickets
              </Button>
            </Link>
```

(`Link` is already imported at line 2.)

- [ ] **Step 4: Remove now-dead code**

- Delete the `EventGrid` import (line 5): `import { EventGrid } from '@/components/EventGrid';`
- Remove `isLoading`/`error` state (lines 19–20) and the `setIsLoading`/`setError` calls inside `loadEvents` (lines 33, 34, 38, 41) — keep `loadEvents` setting `events` only. Simplify `loadEvents` to:

```ts
  const loadEvents = async () => {
    try {
      const data = await api.getEvents();
      setEvents(data);
    } catch (err) {
      console.error('Error loading events:', err);
    }
  };
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npx vitest run` (existing suite green; no reference to removed `#events`/`EventGrid`/`isLoading`/`error`).
Manual: `npm run dev`, load `/` — no events grid at the bottom, softer bottom fade on the hero, and "Explore Events"/"Buy Tickets" navigate to `/discover`.

- [ ] **Step 6: Commit**

```bash
git add src/pages/HomePage.tsx
git commit -m "chore(home): remove events grid, point CTAs to /discover, soften masonry fade"
```

---

### Task 13: Remove the Discover icon from the top nav

**Files:**
- Modify: `src/components/Navbar.tsx` (import line 3; Compass link ~82–86)
- Delete: `src/components/__tests__/NavbarDiscover.test.tsx`

**Interfaces:** none. The `/discover` route and mobile BottomNav Discover tab are unaffected.

- [ ] **Step 1: Delete the obsolete test** (its subject is being removed)

```bash
git rm src/components/__tests__/NavbarDiscover.test.tsx
```

- [ ] **Step 2: Remove the Compass link block** — delete lines 76–86 (the `{/* Discover feed … */}` comment + the `<Link to="/discover" …><Button …><Compass …/></Button></Link>`).

- [ ] **Step 3: Drop the now-unused `Compass` import** — line 3 becomes:

```ts
import { Ticket as TicketIcon, CalendarPlus, Bell } from 'lucide-react';
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npx vitest run`
Expected: green, no unused-import error, no dangling `NavbarDiscover` test.
Manual: the top bar has no compass icon on desktop; `/discover` still reachable via URL and mobile bottom nav.

- [ ] **Step 5: Commit**

```bash
git add src/components/Navbar.tsx
git commit -m "chore(nav): remove desktop Discover icon from the top bar"
```

---

## Self-Review

**Spec coverage:**
- Part A (model + API validation) → Tasks 1–3. ✓
- Part B (media in create modal, two-phase) → Tasks 6–8. ✓
- Part C (external price + currency capture; edit parity) → Tasks 5, 8, 9. ✓
- Part D (currency-aware price display; helper; card + single-event page) → Tasks 3 (serializer), 10–11. Single-event page already returns full doc (Task 3 note) and the card component is shared, so the detail view renders the same price. ✓
- Part E (remove events grid + repoint CTAs; remove Discover icon; soften overlay) → Tasks 12–13. ✓
- Non-goal (no carrot-sold currency / payments changes) respected — currency only read for `ticketing === 'external'` on the card and only sent for external from the dashboard. ✓

**Placeholder scan:** No TBD/TODO. Tasks 9 uses manual verification (UI parity with the fully-tested Task 8 helpers) rather than a bespoke render test — deliberate, not a placeholder. Tasks 12–13 are deletions verified by build + suite; the one behavioral regression risk (price rendering) is covered by Task 11's tests.

**Type consistency:** `Currency = 'SZL' | 'ZAR'` and `currencySymbol` are defined per-app (Task 4 dashboard, Task 10 website) and imported consistently. `submitNewEvent(data, media)` signature in Task 7 matches its call in Task 8. `onNewFilesChange: (files: File[]) => void` defined in Task 6 matches `setGalleryFiles` usage in Task 8. API field names `currency`/`priceMin`/`priceMax` are identical across model (Task 2), validator (Task 1), serializer (Task 3), and both frontends.
