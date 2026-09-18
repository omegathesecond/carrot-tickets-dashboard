// Companion Android POS app — the native handheld/phone app organizers install
// to sell tickets, scan entries and run cashless top-ups at the gate. It is
// distributed as a sideloaded APK (not on the Play Store), hosted on the
// Omevision Google Drive. The download page opens this link in a new tab, where
// Drive serves the APK. To publish a new build, upload it and swap the link here.
export const POS_APP = {
  // Google Drive share link (anyone-with-link → view) for the production POS APK.
  // Points at pos-app-v1.6.0-81dccc8-2026-09-18.apk. This is the FLOOR SERVICE
  // round — seven fixes the waiters and stalls asked for after live service:
  //
  //  - Long product names stopped clipping. The tile's height came from an
  //    aspect ratio, which knows nothing about the font scale or about the
  //    waiter's grid adding a stall line, so a two-line name was squeezed and
  //    sliced mid-glyph ("Captain Morgan Dark Rum (Bottle)"). The tile is now
  //    measured from the text it actually paints.
  //  - Add items opens instantly. It was refetching the ENTIRE event-wide
  //    catalogue on every open, dozens of times a shift, with a guest waiting.
  //  - Removing a line redraws at once instead of after the round-trip, so
  //    nothing looks like it ignored the tap on venue wifi.
  //  - Lines name their stall properly. The screen used to invent
  //    'Stall 4f8a2c' from the id and swap it out once a second fetch landed.
  //  - A waiter works only the tables they opened. A shift lead needs the new
  //    "Works the whole floor" switch (Waiters panel) to close someone else's.
  //  - Both sides get an order count badge: the stall on Tables, the waiter on
  //    Paid. Neither had any way to notice a new order but to go and look.
  //  - Waiters can read a band's balance — the guest asks them, not the desk.
  //
  // Requires the API from 2026-09-18 or later: merchantName and openedByName
  // come off the server, and /api/waiter/balance did not exist before it. That
  // API is live (revision 00253). Older handhelds keep working against it —
  // the scoping is enforced server-side and the new fields are additive — but
  // they will not show the stall names, the badges or the balance button.
  //
  // Lives at Omevision/Builds/carrot-tickets/pos-app/android/ on the Omevision
  // Drive. Signed with the same release key as 1.1.0–1.5.0 — cert SHA-256
  // 03452c0b…3eae39d9, verified identical to 1.5.0's with apksigner — so it
  // upgrades in place. A handheld still carrying a 1.0.0 (debug-signed) build
  // must uninstall first: Android refuses an in-place upgrade across a change
  // of signing certificate, and that build's cert is CN=Android Debug.
  //
  // The /view form serves the 74MB APK with Drive's own Download button — the
  // uc?export=download form breaks on Drive's virus-scan page for large files.
  // While this is empty the download page shows an "unavailable" state rather
  // than a dead link (no silent fallback — the button never points nowhere).
  apkUrl: 'https://drive.google.com/file/d/15Tn15yn6DPlNAVCr-9ivGACBzUppneHQ/view?usp=drive_link',
  // Shown to the organizer so they can tell whether they already have the latest.
  version: '1.6.0',
};
