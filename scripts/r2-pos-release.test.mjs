import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { prepareRelease, releaseFilename } from './r2-pos-release.mjs';
const apk = Buffer.from('signed test APK');
const sha256 = createHash('sha256').update(apk).digest('hex');
const previous = {version:'1.8.1', buildNumber:12, sha256};
const metadata = {version:'1.8.2', buildNumber:13, sha256, commit:'b'.repeat(40)};
test('makes an immutable direct download URL from verified APK metadata', () => {
  const release = prepareRelease(metadata, apk, previous);
  assert.match(release.record.apkUrl, /^https:\/\/cdn.carrottickets.com\/pos\/releases\/carrot-pos-v1.8.2-13-/);
  assert.equal(release.record.sha256, sha256);
  assert.equal(new Date(release.record.publishedAt).toISOString(), release.record.publishedAt);
});
test('rejects mismatched binaries, downgrades and repeated releases', () => {
  assert.throws(() => prepareRelease(metadata, Buffer.from('wrong APK'), previous), /checksum/);
  for(const change of [{buildNumber:12}, {version:'1.8.1'}, {version:'1.7.9'}, {version:'1.10.0',buildNumber:11}]) {
    assert.throws(() => prepareRelease({...metadata,...change}, apk, previous), /increase/);
  }
  assert.equal(prepareRelease({...metadata,version:'1.10.0'},apk,previous).record.version,'1.10.0');
});
test('explicit storage migration permits only the identical already-published release', () => {
  const same = {...metadata,version:previous.version,buildNumber:previous.buildNumber};
  assert.throws(() => prepareRelease(same,apk,previous), /increase/);
  assert.equal(prepareRelease(same,apk,previous,true).record.buildNumber,12);
  assert.throws(() => prepareRelease({...same,buildNumber:11},apk,previous,true), /increase/);
});

test('download names include version, build and the Eswatini release date', () => {
  assert.equal(releaseFilename({version:'1.8.7',buildNumber:18,publishedAt:'2026-10-22T22:30:00.000Z'}), 'carrot-pos-v1.8.7+18-2026-10-23.apk');
});
