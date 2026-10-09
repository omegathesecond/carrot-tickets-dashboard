import {afterEach, expect, it, vi} from 'vitest';
import {fetchPosAppRelease, POS_RELEASE_URL} from '../posApp';
afterEach(() => vi.unstubAllGlobals());
const release = {version:'1.8.2',buildNumber:13,sha256:'a'.repeat(64),apkUrl:'https://cdn.carrottickets.com/pos/releases/carrot-pos-v1.8.2.apk'};
it('reads the canonical R2 record without caching a previous download link', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(release)));
  vi.stubGlobal('fetch',fetchMock);
  expect(await fetchPosAppRelease()).toEqual(release);
  expect(fetchMock).toHaveBeenCalledWith(POS_RELEASE_URL, {signal:undefined,cache:'no-store'});
});
it('fails visibly when R2 is unavailable instead of returning a hardcoded link', async () => {
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('Unavailable',{status:503})));
  await expect(fetchPosAppRelease()).rejects.toThrow('POS download unavailable (503)');
});
it('refuses malformed release records or another download host', async () => {
  for(const change of [{buildNumber:0},{sha256:''},{apkUrl:'https://drive.google.com/file/d/id/view'}]) {
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({...release,...change}))));
    await expect(fetchPosAppRelease()).rejects.toThrow('Invalid POS release record');
  }
});
