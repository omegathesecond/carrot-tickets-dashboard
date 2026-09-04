// Companion Android POS app — the native handheld/phone app organizers install
// to sell tickets, scan entries and run cashless top-ups at the gate. It is
// distributed as a sideloaded APK (not on the Play Store), hosted on the
// Omevision Google Drive. The download page opens this link in a new tab, where
// Drive serves the APK. To publish a new build, upload it and swap the link here.
export const POS_APP = {
  // Google Drive share link (anyone-with-link → view) for the production POS APK.
  // Points at pos-app-v1.1.0-e82f960-2026-09-04.apk — the first release-signed
  // build, and the first with the cashless features (sell-band, top-up, tap
  // check-in, merchant charge, cashier and register desks, stock and basket
  // POS). Lives at Omevision/Builds/carrot-tickets/pos-app/android/ on the
  // Omevision Drive. A handheld still carrying a 1.0.0 (debug-signed) build
  // must uninstall it before installing this one; upgrades install in place
  // from 1.1.0 on.
  // The /view form serves the 74MB APK with Drive's own Download button — the
  // uc?export=download form breaks on Drive's virus-scan page for large files.
  // While this is empty the download page shows an "unavailable" state rather
  // than a dead link (no silent fallback — the button never points nowhere).
  apkUrl: 'https://drive.google.com/file/d/123j5TC8yBmyH-_nZX0xE8iQUpJTBac8r/view?usp=sharing',
  // Shown to the organizer so they can tell whether they already have the latest.
  version: '1.1.0',
};
