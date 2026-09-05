// Companion Android POS app — the native handheld/phone app organizers install
// to sell tickets, scan entries and run cashless top-ups at the gate. It is
// distributed as a sideloaded APK (not on the Play Store), hosted on the
// Omevision Google Drive. The download page opens this link in a new tab, where
// Drive serves the APK. To publish a new build, upload it and swap the link here.
export const POS_APP = {
  // Google Drive share link (anyone-with-link → view) for the production POS APK.
  // Points at pos-app-v1.3.0-607f039-2026-09-05.apk. Adds the WAITER role: a
  // waiter logs in and gets a floor screen rather than the cashier or gate one,
  // opens a table by number, adds items from several stalls onto it, and settles
  // the whole tab against one NFC tag. A minor bump, not a patch, because the
  // app gained a role it did not have. Lives at
  // Omevision/Builds/carrot-tickets/pos-app/android/ on the Omevision Drive.
  // Signed with the same release key as 1.1.0 (CN=Carrot Tickets POS, verified
  // with apksigner), so it upgrades in place. A handheld still carrying a 1.0.0
  // (debug-signed) build must uninstall first.
  // The /view form serves the 71MB APK with Drive's own Download button — the
  // uc?export=download form breaks on Drive's virus-scan page for large files.
  // While this is empty the download page shows an "unavailable" state rather
  // than a dead link (no silent fallback — the button never points nowhere).
  apkUrl: 'https://drive.google.com/file/d/1_Unx-0hUrvD8YqV_ZgJwGHasnU1PwYYc/view?usp=drive_link',
  // Shown to the organizer so they can tell whether they already have the latest.
  version: '1.3.0',
};
