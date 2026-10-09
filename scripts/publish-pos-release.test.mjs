import { test } from 'node:test';
import assert from 'node:assert/strict';
import { releaseRecord } from './publish-pos-release.mjs';
const previous = {version: '1.8.1', buildNumber: 12};
const metadata = {version: '1.8.2', buildNumber: 13, sha256: 'a'.repeat(64), commit: 'b'.repeat(40)};
const url = 'https://drive.google.com/file/d/file123/view?usp=sharing';
test('publishes signed build metadata with its uploaded APK URL', () => {
  assert.deepEqual(releaseRecord(previous, metadata, url), {...metadata, apkUrl: url});
});
test('refuses reuse and downgrade of version or Android build', () => {
  for (const change of [{buildNumber: 12}, {version: '1.8.1'}, {version: '1.7.9'}, {version: '1.8.0'}, {version: '1.10.0', buildNumber: 11}]) {
    assert.throws(() => releaseRecord(previous, {...metadata, ...change}, url), /increase/);
  }
  assert.equal(releaseRecord(previous, {...metadata, version: '1.10.0'}, url).version, '1.10.0');
});
test('refuses missing signature metadata and invalid download URLs', () => {
  assert.throws(() => releaseRecord(previous, {...metadata, sha256: ''}, url), /signed POS build/);
  for (const bad of ['http://drive.google.com/file/d/id/view', 'https://drive.google.com.evil.example/file/d/id/view', 'https://drive.google.com/drive/folders/id']) {
    assert.throws(() => releaseRecord(previous, metadata, bad), /Drive file link/);
  }
});
