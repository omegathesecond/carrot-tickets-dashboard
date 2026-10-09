import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function releaseRecord(previous, metadata, apkUrl) {
  const { version, buildNumber, sha256, commit } = metadata;
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+$/.test(version) || !Number.isSafeInteger(buildNumber) ||
      !/^[a-f0-9]{64}$/.test(sha256) || !/^[a-f0-9]{40}$/.test(commit)) throw new Error('Use release.json from the signed POS build');
  const parts = version.split('.').map(Number), old = previous.version.split('.').map(Number);
  const changed = parts.findIndex((part, i) => part !== old[i]);
  if (buildNumber <= previous.buildNumber || changed < 0 || parts[changed] < old[changed]) throw new Error('Release version and build number must both increase');
  const url = new URL(apkUrl);
  if (url.protocol !== 'https:' || url.hostname !== 'drive.google.com' || !/^\/file\/d\/[a-zA-Z0-9_-]+\/view$/.test(url.pathname)) throw new Error('Supply the uploaded APK’s Google Drive file link');
  return { version, buildNumber, apkUrl: url.toString(), sha256, commit };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = 'public/pos-release.json';
  const release = releaseRecord(JSON.parse(readFileSync(file, 'utf8')), JSON.parse(process.env.RELEASE_JSON), process.env.APK_URL);
  writeFileSync(file, `${JSON.stringify(release, null, 2)}\n`);
  console.log(`Publishing POS ${release.version}+${release.buildNumber}`);
}
