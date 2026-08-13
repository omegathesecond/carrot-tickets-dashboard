// Companion Android POS app — the native handheld/phone app organizers install
// to sell tickets, scan entries and run cashless top-ups at the gate. It is
// distributed as a sideloaded APK (not on the Play Store), hosted on the
// Omevision Google Drive. The download page opens this link in a new tab, where
// Drive serves the APK. To publish a new build, upload it and swap the link here.
export const POS_APP = {
  // Google Drive share link (anyone-with-link → view) for the production POS APK.
  // Points at pos-app-v1.0.0-b1fbe91-2026-07-19.apk (the gate-scanning prod build).
  // The /view form serves the 68MB APK with Drive's own Download button — the
  // uc?export=download form breaks on Drive's virus-scan page for large files.
  // While this is empty the download page shows an "unavailable" state rather
  // than a dead link (no silent fallback — the button never points nowhere).
  apkUrl: 'https://drive.google.com/file/d/1lJBU_qKJTlLduqG5R4kIRJi9wtbnsXPH/view?usp=sharing',
  // Shown to the organizer so they can tell whether they already have the latest.
  version: '1.0.0',
};
