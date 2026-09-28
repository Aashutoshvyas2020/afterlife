import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { createHash } from 'node:crypto';

const token = 'a'.repeat(64);
const paidDb = { prepare: () => ({ bind: hash => ({ first: async () => hash === createHash('sha256').update(token).digest('hex') ? { state: 'paid' } : null }) }) };
const env = { DB: paidDb, CAPABILITY_BASE_URL: 'https://renderer.test', CAPABILITY_AUTH_TOKEN: 'test-renderer-token' };
const paidRun = body => new Request('https://afterlife.test/api/product/run', { method: 'POST', headers: { cookie: `afterlife_access=${token}` }, body: typeof body === 'string' ? body : JSON.stringify(body) });

test('recorded recovery does not claim an artifact deployment or public QA', async () => {
  const result = await (await worker.fetch(new Request('http://localhost:8787/api/status'), {})).json();
  assert.equal(result.resurrection.status, 'ready');
  assert.equal(result.resurrection.evidence, 'recorded');
  assert.equal(result.selectedRepository, 'Edinburgh-Genome-Foundry/DnaFeaturesViewer');
  assert.equal(result.artifact.status, 'pending');
  assert.equal(result.stripe.status, 'pending');
  assert.equal(result.qa.status, 'pending');
  assert.equal(result.deployment.scope, 'local');
  assert.equal(result.deployment.productionUrl, 'http://localhost:8787');
});

test('a 200 HTML page does not pass renderer health', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('<html>hello</html>'));
  const result = await (await worker.fetch(new Request('https://afterlife.test/api/status'), env)).json();
  assert.equal(result.artifact.status, 'failed');
});

test('checkout is blocked if no renderer is connected', async () => {
  const response = await worker.fetch(new Request('https://afterlife.test/api/checkout', { method: 'POST' }), {});
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /renderer/);
});

test('unsupported API methods do not fall through to HTML assets', async () => {
  const response = await worker.fetch(new Request('https://afterlife.test/api/checkout'), { ASSETS: { fetch: () => { throw Error('Must not serve HTML'); } } });
  assert.equal(response.status, 404);
  assert.match(response.headers.get('content-type'), /json/);
});

test('oversize multibyte inputs are rejected before contacting renderer', async t => {
  t.mock.method(globalThis, 'fetch', async () => { throw Error('Must not fetch'); });
  const response = await worker.fetch(paidRun({ input: '🧬'.repeat(10000) }), env);
  assert.equal(response.status, 413);
});

test('renderer validation errors remain actionable', async t => {
  t.mock.method(globalThis, 'fetch', async (_, init) => {
    assert.equal(init.headers.authorization, 'Bearer test-renderer-token');
    return Response.json({ error: 'Feature coordinates exceed sequence length' }, { status: 400 });
  });
  const response = await worker.fetch(paidRun({ input: {} }), env);
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /coordinates/);
});

test('invalid renderer output never appears as successful analysis', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ result: 'fake' }));
  const response = await worker.fetch(paidRun({ input: {} }), env);
  assert.equal(response.status, 502);
});
