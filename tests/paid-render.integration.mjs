// Full Worker -> real Python HTTP renderer test. Stripe and D1 are isolated fixtures.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import worker from '../src/legacy-worker.js';
import { fakeDb } from './helpers/billing.mjs';

const sample = JSON.parse(readFileSync(new URL('../person1/build/dna-feature-map/verification/input_alpha.json', import.meta.url)));

test('verified test payment -> entitlement -> real DNA map over HTTP', async t => {
  const actualFetch = globalThis.fetch;
  const DB = fakeDb();
  const env = { DB, CAPABILITY_BASE_URL: process.env.CAPABILITY_TEST_URL || 'http://127.0.0.1:8090', CAPABILITY_AUTH_TOKEN: process.env.CAPABILITY_TEST_TOKEN || 'afterlife-local-test', STRIPE_SECRET_KEY: 'sk_test_integration', STRIPE_PRICE_ID: 'price_integration', STRIPE_WEBHOOK_SECRET: 'whsec_integration' };
  const origin = 'https://afterlife.test';
  t.mock.method(globalThis, 'fetch', async (input, init) => {
    const url = new URL(input);
    if (url.hostname !== 'api.stripe.com') return actualFetch(input, init);
    if (url.pathname.startsWith('/v1/prices/')) return Response.json({ id: env.STRIPE_PRICE_ID, active: true, livemode: false, type: 'one_time', unit_amount: 500, currency: 'usd' });
    if (url.pathname === '/v1/checkout/sessions') return Response.json({ id: 'cs_test_integration', mode: 'payment', livemode: false, url: 'https://checkout.stripe.com/c/pay/cs_test_integration' });
    if (url.pathname === '/v1/checkout/sessions/cs_test_integration') return Response.json({ id: 'cs_test_integration', mode: 'payment', livemode: false, payment_status: 'paid', line_items: { data: [{ price: { id: env.STRIPE_PRICE_ID }, quantity: 1 }] } });
    throw Error('Unexpected Stripe call');
  });
  const status = await (await worker.fetch(new Request(origin + '/api/status'), env)).json();
  assert.equal(status.artifact.status, 'ready');
  assert.equal(status.stripe.status, 'ready');
  const submit = cookie => worker.fetch(new Request(origin + '/api/product/run', { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ input: sample }) }), env);
  assert.equal((await submit('')).status, 403);
  const checkout = await worker.fetch(new Request(origin + '/api/checkout', { method: 'POST' }), env);
  assert.equal(checkout.status, 200);
  const cookie = checkout.headers.get('set-cookie').split(';')[0];
  assert.equal((await submit(cookie)).status, 403, 'pending payment must remain locked');
  const verified = await worker.fetch(new Request(origin + '/api/checkout/verify?session_id=cs_test_integration', { headers: { cookie } }), env);
  assert.equal((await verified.json()).entitled, true);
  const response = await submit(cookie);
  assert.equal(response.status, 200);
  const { result } = await response.json();
  const png = Buffer.from(result.imageBase64, 'base64');
  assert.deepEqual([...png.subarray(0, 8)], [137,80,78,71,13,10,26,10]);
  assert.equal(result.sequenceLength, 488);
  assert.equal(result.featureCount, 3);
  assert.equal(result.pngBytes, png.length);
  assert.equal(result.sha256, createHash('sha256').update(png).digest('hex'));
  assert.equal(png.readUInt32BE(16), 865);
  assert.equal(png.readUInt32BE(20), 255);
});
