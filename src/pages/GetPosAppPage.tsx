import { Smartphone, Download, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { POS_APP } from '@/lib/posApp';
import { BRAND_NAME, SUPPORT_EMAIL } from '@/lib/brand';

// Permanent home for the POS-app download. The one-time "install the app" prompt
// only ever shows once, so organizers who dismissed it had no way back — this
// page is the always-available link. It lives in the dashboard sidebar so it
// never disappears.
const INSTALL_STEPS = [
  'Tap “Download APK” below on the Android phone or handheld you’ll use at the gate.',
  'Open the downloaded file. Android will ask to allow installs from this source — turn it on.',
  'Install, then open the app and sign in with your organizer login.',
];

export function GetPosAppPage() {
  const hasApk = POS_APP.apkUrl.trim().length > 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-white">
            <Smartphone className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Get the POS app</h1>
            <p className="text-sm text-slate-500">
              The {BRAND_NAME} handheld app for selling &amp; scanning tickets at your events.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Download for Android</CardTitle>
            <CardDescription>
              Sell tickets, scan entries and run cashless top-ups on an Android phone or ZCS handheld.
              Version {POS_APP.version}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasApk ? (
              <Button
                asChild
                className="w-full sm:w-auto bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700"
              >
                {/* Google Drive serves the APK from its own page — open there in a
                    new tab rather than relying on the (cross-origin-ignored)
                    download attribute. */}
                <a href={POS_APP.apkUrl} target="_blank" rel="noopener noreferrer">
                  <Download className="mr-2 h-4 w-4" />
                  Download APK
                </a>
              </Button>
            ) : (
              // No silent fallback: until the production APK URL is wired we show
              // a clear unavailable state instead of a button that links nowhere.
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                The download isn’t available yet. Please contact{' '}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium underline">
                  {SUPPORT_EMAIL}
                </a>{' '}
                and we’ll send you the app.
              </div>
            )}
            <p className="flex items-start gap-2 text-xs text-slate-500">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              This is the official {BRAND_NAME} app, distributed directly (not via the Play Store),
              so Android will ask you to confirm the install.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">How to install</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {INSTALL_STEPS.map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-slate-700">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-700">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <p className="mt-4 flex items-center gap-2 text-xs text-slate-500">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
              Same login as this dashboard — no separate account needed.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
