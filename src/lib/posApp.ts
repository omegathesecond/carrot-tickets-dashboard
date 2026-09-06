// Companion Android POS app — the native handheld/phone app organizers install
// to sell tickets, scan entries and run cashless top-ups at the gate. It is
// distributed as a sideloaded APK (not on the Play Store), hosted on the
// Omevision Google Drive. The download page opens this link in a new tab, where
// Drive serves the APK. To publish a new build, upload it and swap the link here.
export const POS_APP = {
  // Google Drive share link (anyone-with-link → view) for the production POS APK.
  // Points at pos-app-v1.4.0-bad1fbf-2026-09-06.apk. Adds the table HANDOVER:
  // a settled table now tracks, per stall, whether that counter has handed its
  // stock over and whether the waiter has accepted it — the bar sees which
  // tables have paid, the waiter confirms collection, and neither side can
  // close a handover alone. The waiter's floor list gains New / Paid /
  // Collected tabs and a search over the table number or name, and the stall
  // app gains a Tables tab of its own.
  //
  // It also fixes two bugs 1.3.0 shipped with. A waiter reopening the app
  // landed on the reseller sell-tickets screen instead of the floor (fresh
  // logins were fine, which is why it looked intermittent). And the
  // organizer's "Settling on" toggle did nothing: the grant was read from a
  // token minted at login and good for 7 days, so a waiter granted settling
  // could not settle until they signed out and back in — and one whose grant
  // was REVOKED kept a Settle button the server would refuse in front of a
  // guest. Both halves now read the waiter's row.
  //
  // Requires the API from the same date — the app calls four routes that did
  // not exist before it (the two handover endpoints and the two stall table
  // reads).
  //
  // Lives at Omevision/Builds/carrot-tickets/pos-app/android/ on the Omevision
  // Drive. Signed with the same release key as 1.1.0 (CN=Carrot Tickets POS;
  // the signing cert's SHA-256 was checked against 1.3.0's and is identical),
  // so it upgrades in place. A handheld still carrying a 1.0.0 (debug-signed)
  // build must uninstall first.
  // The /view form serves the 74MB APK with Drive's own Download button — the
  // uc?export=download form breaks on Drive's virus-scan page for large files.
  // While this is empty the download page shows an "unavailable" state rather
  // than a dead link (no silent fallback — the button never points nowhere).
  apkUrl: 'https://drive.google.com/file/d/1orSKFDk-qKsY7HbVL2s-xYZFKUzwjct2/view?usp=drive_link',
  // Shown to the organizer so they can tell whether they already have the latest.
  version: '1.4.0',
};
