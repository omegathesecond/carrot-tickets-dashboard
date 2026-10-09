import { Smartphone, Download, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { fetchPosAppRelease } from '@/lib/posApp';
import { useQuery } from '@tanstack/react-query';
import { BRAND_NAME } from '@/lib/brand';

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
  const { data: release, error, isLoading, refetch } = useQuery({
    queryKey: ['pos-app-release'], queryFn: ({ signal }) => fetchPosAppRelease(signal),
    staleTime: 60_000, refetchInterval: 300_000, retry: false,
  });

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
              {release && !error && <>Version {release.version}.</>}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {release && !error ? (
              <Button
                asChild
                className="w-full sm:w-auto bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700"
              >
                <a href={release.apkUrl}>
                  <Download className="mr-2 h-4 w-4" />
                  Download APK
                </a>
              </Button>
            ) : (
              <div role={error ? 'alert' : 'status'} className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                {isLoading ? 'Loading the latest POS download…' : (error?.message || 'POS download unavailable.')}
                {error && <Button variant="outline" className="ml-3" onClick={() => refetch()}>Retry</Button>}
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
