// Companion Android POS app — the native handheld/phone app organizers install
// to sell tickets, scan entries and run cashless top-ups at the gate. It is
// distributed as a sideloaded APK (not on the Play Store), hosted on the
// Omevision Google Drive. The download page opens this link in a new tab, where
// Drive serves the APK. To publish a new build, upload it and swap the link here.
export const POS_APP = {
  // Google Drive share link (anyone-with-link → view) for the production POS APK.
  // Points at pos-app-v1.5.0-684ede1-2026-09-09.apk. This is the MULTI-TIER
  // build: the till can now ring up several ticket types in ONE sale, so a
  // customer buying General AND VIP is one payment, one receipt and one row in
  // the reseller's takings instead of two transactions rung separately. Each
  // tier has its own +/- on the Tickets step; a tier's + stops at its own
  // remaining stock and at whatever the other lines leave of the 10-per-sale
  // cap, which the API applies to the whole cart.
  //
  // It also fixes a bug that only bites once a basket exists: every printed
  // stub carried the SALE's single ticket-type name, so in a mixed sale a VIP
  // ticket would have printed "General" and been turned away at the gate.
  // Each stub now names its own tier.
  //
  // Requires the API from 2026-09-09 or later (the reseller sale route must
  // accept `items[]`). That API is live, and it still accepts the old
  // single-tier body, so tills on 1.4.0 keep working until they update.
  //
  // Lives at Omevision/Builds/carrot-tickets/pos-app/android/ on the Omevision
  // Drive. Signed with the same release key as 1.1.0–1.4.0 — cert SHA-256
  // 03452c0b…3eae39d9, verified identical to 1.4.0's with apksigner — so it
  // upgrades in place. A handheld still carrying a 1.0.0 (debug-signed) build
  // must uninstall first.
  //
  // The /view form serves the 74MB APK with Drive's own Download button — the
  // uc?export=download form breaks on Drive's virus-scan page for large files.
  // While this is empty the download page shows an "unavailable" state rather
  // than a dead link (no silent fallback — the button never points nowhere).
  apkUrl: 'https://drive.google.com/file/d/1LvJWup38uWO-I4pc4pZ-Xbs35KCsbD0v/view?usp=drive_link',
  // Shown to the organizer so they can tell whether they already have the latest.
  version: '1.5.0',
};
