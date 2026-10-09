import test from 'node:test';
import assert from 'node:assert/strict';
import {notifyRecipients} from './release-notifications.mjs';
test('provider failure still attempts the other recipient and remains visible', async()=>{
  const calls=[];
  await assert.rejects(notifyRecipients(['first@example.com','second@example.com'],async to=>{
    calls.push(to);
    if(to==='first@example.com')throw new Error('Provider unavailable');
  }),/first@example.com: Provider unavailable/);
  assert.deepEqual(calls,['first@example.com','second@example.com']);
});
