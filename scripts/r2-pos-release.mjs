import { createHash } from 'node:crypto';
export const R2_ACCOUNT = '9f074c8dd70baaa27e08c1602bdec69a';
export const R2_BUCKET = 'carrot-tickets-media-prod';
export const RELEASE_URL = 'https://cdn.carrottickets.com/pos/latest.json';
export function prepareRelease(metadata, apk, previous, migrate = false) {
  const {version, buildNumber, sha256, commit} = metadata;
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+$/.test(version) || !Number.isSafeInteger(buildNumber) || buildNumber <= 0 ||
      !/^[a-f0-9]{64}$/.test(sha256) || !/^[a-f0-9]{40}$/.test(commit)) throw new Error('Use metadata from the signed POS release');
  if (createHash('sha256').update(apk).digest('hex') !== sha256) throw new Error('APK checksum does not match the signed release metadata');
  if (previous) {
    const parts = version.split('.').map(Number), old = previous.version.split('.').map(Number);
    const changed = parts.findIndex((part, i) => part !== old[i]);
    const same = version === previous.version && buildNumber === previous.buildNumber && sha256 === previous.sha256;
    if (!(migrate && same) && (buildNumber <= previous.buildNumber || changed < 0 || parts[changed] < old[changed])) throw new Error('Release version and build number must both increase');
  }
  const key = `pos/releases/carrot-pos-v${version}-${buildNumber}-${sha256.slice(0, 12)}.apk`;
  return {key, record: {version, buildNumber, sha256, commit, apkUrl: `https://cdn.carrottickets.com/${key}`}};
}
export async function putObject(token, key, body, type, cacheControl, disposition) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${R2_ACCOUNT}/r2/buckets/${R2_BUCKET}/objects/${key}`, {
    method: 'PUT', headers: {Authorization: `Bearer ${token}`, 'Content-Type': type, 'Cache-Control': cacheControl,
      ...(disposition ? {'Content-Disposition': disposition} : {})}, body, signal: AbortSignal.timeout(180000),
  });
  if (!response.ok) throw new Error(`R2 upload failed (${response.status})`);
  await response.arrayBuffer();
}
export async function uploadApk(token, release, apk) {
  await putObject(token, release.key, apk, 'application/vnd.android.package-archive', 'public, max-age=31536000, immutable', `attachment; filename="carrot-pos-v${release.record.version}.apk"`);
  const response = await fetch(release.record.apkUrl, {method: 'HEAD', signal: AbortSignal.timeout(30000)});
  const etag = response.headers.get('etag')?.replaceAll('"', '');
  if (!response.ok || Number(response.headers.get('content-length')) !== apk.length ||
      etag !== createHash('md5').update(apk).digest('hex')) throw new Error('Public R2 download does not match the uploaded APK');
}
export async function promoteRelease(token, release) {
  await putObject(token, 'pos/latest.json', Buffer.from(JSON.stringify(release.record, null, 2) + '\n'), 'application/json', 'no-store');
  const response = await fetch(`${RELEASE_URL}?release=${release.record.sha256}`, {cache:'no-store', signal:AbortSignal.timeout(30000)});
  if (!response.ok || JSON.stringify(await response.json()) !== JSON.stringify(release.record)) throw new Error('Published POS release record does not match');
}
