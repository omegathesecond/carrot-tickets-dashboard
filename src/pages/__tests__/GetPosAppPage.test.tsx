// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GetPosAppPage } from '@/pages/GetPosAppPage';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('shows the release date in Eswatini beside the version of the linked APK', async () => {
  const release = {
    version: '1.8.7', buildNumber: 18,
    publishedAt: '2026-10-22T22:30:00.000Z',
    sha256: 'a'.repeat(64),
    apkUrl: 'https://cdn.carrottickets.com/pos/releases/carrot-pos-v1.8.7-18.apk',
  };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(release))));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<QueryClientProvider client={client}><GetPosAppPage /></QueryClientProvider>);
  const date = await screen.findByText('23 October 2026');
  expect(date.getAttribute('datetime')).toBe(release.publishedAt);
  expect(date.parentElement?.textContent).toContain('Version 1.8.7 (build 18)');
  expect(screen.getByRole('link', { name: 'Download APK' }).getAttribute('href')).toBe(release.apkUrl);
  client.clear();
});
