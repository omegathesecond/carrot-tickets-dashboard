export const POS_RELEASE_URL = 'https://cdn.carrottickets.com/pos/latest.json';
export interface PosAppRelease {
  version: string;
  buildNumber: number;
  apkUrl: string;
  sha256: string;
}
export async function fetchPosAppRelease(signal?: AbortSignal): Promise<PosAppRelease> {
  const response = await fetch(POS_RELEASE_URL, { signal, cache: 'no-store' });
  if (!response.ok) throw new Error(`POS download unavailable (${response.status})`);
  const release = await response.json() as PosAppRelease;
  const url = new URL(release.apkUrl);
  if (!/^\d+\.\d+\.\d+$/.test(release.version) || !Number.isSafeInteger(release.buildNumber) || release.buildNumber <= 0 ||
      !/^[a-f0-9]{64}$/.test(release.sha256) || url.protocol !== 'https:' || url.hostname !== 'cdn.carrottickets.com' ||
      !url.pathname.startsWith('/pos/releases/') || !url.pathname.endsWith('.apk')) throw new Error('Invalid POS release record');
  return release;
}
