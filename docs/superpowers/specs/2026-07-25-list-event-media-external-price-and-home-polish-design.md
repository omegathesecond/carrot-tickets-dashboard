# List-event media + external price, and home-page polish — design

- **Date:** 2026-07-25
- **Status:** Approved (design), pre-implementation
- **Repos touched:** `carrot-tickets-api` (`main`), `carrot-tickets-dashboard` (`main`), `carrot-tickets-website` (local folder `landing/`, `master`)

## Summary

Two related dashboard gaps and three landing tweaks, requested together:

1. **Media in the create-event modal.** The "list an event" modal captures no images, so a
   new event renders as a bare colored gradient placeholder on its card ("it only shows
   colors"). Let organizers add a **poster + gallery** right in the modal.
2. **A price for external events.** Events where the organizer sells their own tickets
   (`ticketing: 'external'`) have no ticket tiers, so their cards show no price. Let them set a
   **From–To price with a currency (E / R)** for display.
3. **Landing polish:** remove the home-page events grid, remove the top-bar Discover icon, and
   soften the masonry hero's bottom fade.

## Decisions (locked with the requester)

- **Media upload = inline, one submit.** Pick images in the modal; on submit, create the event
  then upload the picked files to the returned `_id`. One button.
- **External price = range + currency.** Optional `From`–`To` with an `E`/`R` picker.
- **Currency scope = external/display only.** The `E`/`R` choice applies only where Carrot is
  **not** processing payment. Carrot-sold ticket tiers, checkout, MoMo/card, POS, and payouts
  stay in Emalangeni (E / SZL). Currency here is a display label, nothing more.
- **Home events = remove the whole grid section.** The auto-scrolling masonry poster hero stays.
- **Home CTAs repoint to `/discover`.** The "Explore Events" / "Buy Tickets" `#events` anchors
  lose their target, so they now link to `/discover`.

## Non-goals

- Multi-currency for **carrot-sold** tickets (tiers, checkout, MoMo/card, POS, payouts). That is
  a separate, larger payments change and is explicitly out of scope here.
- New media endpoints. The `/media/events/:id/{poster,gallery,thumbnail}` routes already exist and
  are reused unchanged.
- Changing how carrot-sold events compute their card price (still min–max of ticket tiers, in E).

---

## Part A — Data model & API (`carrot-tickets-api`)

Add three fields to the Event schema + interface:

- `currency: 'SZL' | 'ZAR'` — default `'SZL'`. Display symbol: `SZL → 'E'`, `ZAR → 'R'`.
- `priceMin?: number` (min 0)
- `priceMax?: number` (min 0)

**Files:**
- `src/models/event.model.ts` — new fields in `eventSchema` (near the existing "Sales Info" /
  ticketing block).
- `src/interfaces/event.interface.ts` — add the same fields to `IEvent`.

**Endpoints (create + update):** `POST /tickets/events` and `PUT /tickets/events/:id` accept
`currency`, `priceMin`, `priceMax`. Validation:
- `currency`, when present, must be `'SZL'` or `'ZAR'`.
- `priceMin` / `priceMax`, when present, must be ≥ 0.
- when both are present, `priceMax >= priceMin` (else 400).
- These are only *meaningful* for `ticketing === 'external'`; for `carrot` events they are ignored
  by the display layer (see Part D). We do not hard-reject them for carrot events — simpler, and
  harmless since nothing reads them there.

No pre-save hook changes. Existing events have no stored `currency` → reads must treat absent as
`'SZL'` (default in schema covers new writes; display helper defaults too, for `.lean()` reads).

---

## Part B — Create-event modal: media (`carrot-tickets-dashboard`)

**File:** `src/pages/EventsPage.tsx` — the create `<Dialog>` (≈222–330) and `handleSubmit` (≈151–204).

**UI:** below the date/time fields, add a "Media" block:
- `<ImageUploadInput label="Event poster" ... />` — reused as-is. It previews the picked file
  locally (FileReader) and emits `onFileSelect(file)`; capture into `posterFile` state, clear on
  `onRemove`. No component change needed.
- `<GalleryManager label="Event photos" ... />` — reused with a small additive enhancement
  (see below). Capture the picked files into `galleryFiles` state.
- Encouraging copy: e.g. *"Add a poster and a few event photos — events with images get far more
  views, and multiple photos animate on the card."* (The masonry hero cycles `galleryImages`, so
  the gallery directly feeds that animation.)

**Deferred-file sync (GalleryManager enhancement — additive, backward-compatible):**
`GalleryManager` currently keeps only preview data-URLs and, for a not-yet-uploaded image, its
remove button drops the preview **without notifying the parent**. In the create modal there is no
`eventId` yet, so the parent must own the real `File[]`. Enhancement:
- store the `File` alongside each new preview internally, and
- add an **optional** prop `onNewFilesChange?: (files: File[]) => void` that fires the full current
  set of not-yet-uploaded files on every add and every remove.
The create modal passes `onNewFilesChange={setGalleryFiles}` and uses that as the source of truth.
The event-details page does not pass it → its behavior is unchanged.

**Two-phase submit (`handleSubmit`):**
1. Validate (existing checks + external price, Part C).
2. `const created = await apiClient.events.createEvent(payload)` → `created._id`.
3. If `posterFile`: `await apiClient.events.uploadPoster(created._id, posterFile)`.
4. If `galleryFiles.length`: `await apiClient.events.uploadGalleryImages(created._id, galleryFiles)`.
5. Invalidate the events query, close, reset modal state. Optionally navigate to the new event.

The submit button stays in a loading state across create **and** uploads.

**Layout:** the modal grows tall with the media block — give the dialog body
`max-h-[85vh] overflow-y-auto` if it doesn't already scroll.

---

## Part C — Create-event modal: external price + currency (`carrot-tickets-dashboard`)

Inside the existing `ticketing === 'external'` branch (below the ticket-link field), add:
- a **currency** select — options `E` (SZL) / `R` (ZAR), default `E`;
- **From** and **To** number inputs (`min=0`, `step=0.01`), both optional.

State: `currency`, `priceMin`, `priceMax`. Validation in `handleSubmit`: if both set,
`priceMax >= priceMin` (inline error, block submit). Fold into the payload builder (extend
`buildTicketingPayload` in `src/lib/ticketing.ts`, or add a sibling helper) so the create payload
carries `currency`/`priceMin`/`priceMax` **only for external events**; carrot events omit them.

**Types:** add `currency?`, `priceMin?`, `priceMax?` to `Event` and `EventFormData` in
`src/types/index.ts`.

**Edit parity:** the event-details page (`EventDetailsPage.tsx`) already edits the external ticket
link; add the same currency + price-range fields there and send via `updateEvent`, so an external
event's price is editable after creation. (Same three form fields, reused.)

---

## Part D — Price display (`carrot-tickets-website` + `carrot-tickets-dashboard`)

**Currency helper** (one per app, DRY within each):
`currencySymbol(currency?: 'SZL' | 'ZAR'): string` → `'R'` for `ZAR`, else `'E'` (default).
- landing: `src/lib/currency.ts`
- dashboard: `src/lib/currency.ts`

**Landing `EventCard.tsx` price block (≈52–56, 232–238):**
- Carrot events (ticket tiers present): unchanged — `E{min}` / `E{min} – E{max}` from
  `ticketTypes`, always `E`.
- External events (no tiers) with a `priceMin`: show `{sym}{min}` or `{sym}{min} – {sym}{max}`
  using `currencySymbol(event.currency)`.
- External with no `priceMin`: no price shown (today's behavior).

**Landing public event page:** show the external price next to the "Get tickets" link-out, same
helper.

**Landing types:** add `currency?`, `priceMin?`, `priceMax?` to the `Event` type.

**Dashboard details page:** display the stored external price using the dashboard helper (the
create/edit forms handle input; this is the read-back).

---

## Part E — Landing home page & nav polish (`carrot-tickets-website`)

1. **Remove the events grid.** Delete the bottom `#events` `<section>` in
   `src/pages/HomePage.tsx` (≈179–218). Drop the now-unused `EventGrid` import and the
   `isLoading` / `error` state + error UI. **Keep** `events` + `loadEvents` — the masonry hero
   (`<EventMasonry events={events} />`) still needs them. Repoint the two `#events` CTA anchors
   ("Explore Events", "Buy Tickets") to `/discover`.
2. **Remove the Discover icon.** Delete the `<Link to="/discover">` Compass block in
   `src/components/Navbar.tsx` (≈82–86), remove `Compass` from the lucide import, and delete
   `src/components/__tests__/NavbarDiscover.test.tsx`. (Mobile BottomNav keeps its Discover tab;
   the `/discover` route is untouched.)
3. **Soften the masonry bottom fade.** `HomePage.tsx:73` — reduce the overlay from
   `h-44 … via-background/70` to `h-24 … via-background/40` (subtler, less jarring).

---

## Error handling

- **Upload after create fails:** the event already exists. Surface the failure loudly (toast /
  inline error): *"Event created, but the poster/photos didn't upload: <reason>. Add them from the
  event page."* Do **not** silently swallow it and do **not** fabricate a placeholder — the user
  must know images are missing (per the global no-silent-fallback rule). The created event is kept.
- **Create fails:** surface the API error as today; nothing is uploaded.
- **API validation** (`priceMax < priceMin`, bad currency): 400 with a clear message; the form
  also blocks client-side.

## Testing

- **api:** unit tests for create/update accepting + validating `currency`/`priceMin`/`priceMax`
  (valid pair, `max < min` rejected, bad currency rejected, carrot event ignores them).
- **dashboard:** `handleSubmit` two-phase flow (create → uploadPoster → uploadGallery), including
  the "create OK but upload fails" branch surfacing an error and keeping the event; external
  price validation; `GalleryManager` `onNewFilesChange` emits the correct set after add + remove.
- **landing:** `EventCard` renders `R100 – R250` for a `ZAR` external event and `E100 – E250` for
  a carrot event; `NavbarDiscover.test.tsx` removed; a HomePage test asserting the events grid is
  gone and CTAs point to `/discover`.

## Repo boundaries / sequencing

1. **api** first (model + endpoints + validation) — the dashboard write depends on it.
2. **dashboard** (modal media + external price + details-page parity + types).
3. **landing** (card/public price display + the three home/nav tweaks) — independent of 1–2 for
   the polish items; the price-display item depends on api returning the new fields.

## Open items

None blocking. The details-page edit parity (Part C "Edit parity") and public-event-page price
(Part D) are included for coherence; if we want to ship the create-modal + home polish first, those
two read/edit surfaces can be a fast follow.
