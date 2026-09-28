import { fakeDb } from './helpers/billing.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/legacy-worker.js';
import { createHash, createHmac } from 'node:crypto';

const envBase = {
  CAPABILITY_BASE_URL: 'https://recovered.test',
  STRIPE_SECRET_KEY: 'sk_test_regression',
  STRIPE_PRICE_ID: 'price_regression',
  STRIPE_WEBHOOK_SECRET: 'whsec_regression',
};


function stripeSession(id, checkoutKey) {
  return {
    id, mode: 'payment', livemode: false, payment_status: 'paid',
    metadata: { checkout_key: checkoutKey },
    line_items: { data: [{ price: { id: envBase.STRIPE_PRICE_ID }, quantity: 1 }] },
  };
}

function withStripe(db, sessions = {}) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(input);
    if (url.hostname === 'recovered.test' && url.pathname === '/health') return Response.json({ status: 'healthy', service: 'dna-feature-map' });
    if (url.pathname.endsWith('/prices/' + envBase.STRIPE_PRICE_ID)) {
      return Response.json({ id: envBase.STRIPE_PRICE_ID, livemode: false, active: true, type: 'one_time' });
    }
    if (url.pathname.endsWith('/checkout/sessions') && init.method === 'POST') {
      assert.equal(new URLSearchParams(init.body).get('payment_method_types[0]'), 'card');
      return Response.json({ id: 'cs_test_checkout1', mode: 'payment', livemode: false, url: 'https://checkout.stripe.com/session' });
    }
    const match = url.pathname.match(/\/checkout\/sessions\/(cs_test_[A-Za-z0-9]+)$/);
    if (match && sessions[match[1]]) return Response.json(sessions[match[1]]);
    return Response.json({ error: 'unexpected Stripe request' }, { status: 404 });
  };
  return () => { globalThis.fetch = originalFetch; };
}

function env(db) { return { ...envBase, DB: db }; }

test('checkout fails closed when Stripe credentials are absent', async () => {
  const response = await worker.fetch(new Request('https://afterlife.test/api/checkout', { method: 'POST' }), {
    DB: fakeDb(), STRIPE_PRICE_ID: envBase.STRIPE_PRICE_ID, STRIPE_WEBHOOK_SECRET: envBase.STRIPE_WEBHOOK_SECRET,
  });
  assert.equal(response.status, 503);
  assert.doesNotMatch(JSON.stringify(await response.json()), /secret|sk_test_/i);
});

test('Checkout API failure does not leak Stripe error details', async () => {
  const db = fakeDb();
  const restore = globalThis.fetch;
  globalThis.fetch = async input => new URL(input).hostname === 'recovered.test' ? Response.json({ status: 'healthy', service: 'dna-feature-map' }) : Response.json({ error: { message: 'private upstream response' } }, { status: 500 });
  try {
    const response = await worker.fetch(new Request('https://afterlife.test/api/checkout', { method: 'POST' }), env(db));
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { success: false, error: 'Checkout could not be created' });
  } finally { globalThis.fetch = restore; }
});

test('paid execution rejects invalid input and remains unavailable without a recovered artifact', async () => {
  const token = 'a'.repeat(64);
  const db = fakeDb();
  db.entitlements.push({ token_hash: createHash('sha256').update(token).digest('hex'), state: 'paid' });
  const paidEnv = { ...env(db) };
  paidEnv.CAPABILITY_BASE_URL = 'https://recovered.test';
  const request = body => worker.fetch(new Request('https://afterlife.test/api/product/run', {
    method: 'POST', headers: { cookie: `afterlife_access=${token}`, 'content-type': 'application/json' }, body,
  }), paidEnv);
  const invalid = await request('{}');
  assert.equal(invalid.status, 400);
  delete paidEnv.CAPABILITY_BASE_URL;
  const missingArtifact = await request('{"input":{}}');
  assert.equal(missingArtifact.status, 503);
  assert.deepEqual(await missingArtifact.json(), { success: false, error: 'Recovered artifact is not configured' });
});

test('product run rejects callers without a paid entitlement', async () => {
  const db = fakeDb();
  const restore = withStripe(db);
  try {
    const response = await worker.fetch(new Request('https://afterlife.test/api/product/run', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ input: 'hello' }),
    }), env(db));
    assert.equal(response.status, 403);
    assert.equal((await response.json()).success, false);
  } finally { restore(); }
});

test('webhook rejects a tampered Stripe signature without recording an event', async () => {
  const db = fakeDb();
  const body = JSON.stringify({ id: 'evt_tampered', type: 'checkout.session.completed', data: { object: {} } });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac('sha256', envBase.STRIPE_WEBHOOK_SECRET).update(`${timestamp}.${body}`).digest('hex');
  const tampered = body.replace('evt_tampered', 'evt_modified');
  const response = await worker.fetch(new Request('https://afterlife.test/api/stripe/webhook', {
    method: 'POST', headers: { 'stripe-signature': `t=${timestamp},v1=${signature}` }, body: tampered,
  }), env(db));
  assert.equal(response.status, 400);
  assert.equal(db.entitlements.length, 0);
});

test('replaying a valid webhook leaves paid entitlement intact', async () => {
  const db = fakeDb();
  const checkoutKey = 'a'.repeat(64);
  db.entitlements.push({ token_hash: 'existing-token-hash', checkout_key: checkoutKey, checkout_session_id: null, state: 'pending' });
  const id = 'cs_test_replay1';
  const session = stripeSession(id, checkoutKey);
  const restore = withStripe(db, { [id]: session });
  const body = JSON.stringify({ id: 'evt_replay', type: 'checkout.session.completed', data: { object: session } });
  async function deliver() {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac('sha256', envBase.STRIPE_WEBHOOK_SECRET).update(`${timestamp}.${body}`).digest('hex');
    return worker.fetch(new Request('https://afterlife.test/api/stripe/webhook', {
      method: 'POST', headers: { 'stripe-signature': `t=${timestamp},v1=${signature}` }, body,
    }), env(db));
  }
  try {
    assert.equal((await deliver()).status, 200);
    assert.equal((await deliver()).status, 200);
    assert.deepEqual(db.entitlements.map(({ state, checkout_session_id }) => ({ state, checkout_session_id })), [{ state: 'paid', checkout_session_id: id }]);
  } finally { restore(); }
});

test('paid verification grants only the cookie that owns the checkout session', async () => {
  const db = fakeDb();
  const restore = withStripe(db, { cs_test_checkout1: stripeSession('cs_test_checkout1', 'placeholder') });
  try {
    const checkout = await worker.fetch(new Request('https://afterlife.test/api/checkout', { method: 'POST' }), env(db));
    assert.equal(checkout.status, 200);
    const token = checkout.headers.get('set-cookie').match(/afterlife_access=([a-f0-9]{64})/)[1];
    const row = db.entitlements[0];
    const session = stripeSession('cs_test_checkout1', row.checkout_key);
    globalThis.fetch = async () => Response.json(session);
    const verify = cookie => worker.fetch(new Request('https://afterlife.test/api/checkout/verify?session_id=cs_test_checkout1', {
      headers: { cookie: `afterlife_access=${cookie}` },
    }), env(db));
    const denied = await verify('b'.repeat(64));
    assert.equal(denied.status, 403);
    const accepted = await verify(token);
    assert.equal(accepted.status, 200);
    assert.equal((await accepted.json()).entitled, true);
    const entitlement = await worker.fetch(new Request('https://afterlife.test/api/entitlement', {
      headers: { cookie: `afterlife_access=${token}` },
    }), env(db));
    assert.equal((await entitlement.json()).entitled, true);
  } finally { restore(); }
});

test('a second checkout does not replace already paid browser access', async () => {
  const token = 'c'.repeat(64), db = fakeDb();
  db.entitlements.push({ token_hash: createHash('sha256').update(token).digest('hex'), state: 'paid' });
  const restore = withStripe(db);
  try {
    const response = await worker.fetch(new Request('https://afterlife.test/api/checkout', { method: 'POST', headers: { cookie: `afterlife_access=${token}` } }), env(db));
    assert.equal(response.status, 409);
    assert.equal(response.headers.get('set-cookie'), null);
    assert.equal(db.entitlements.length, 1);
    assert.equal(db.entitlements[0].state, 'paid');
  } finally { restore(); }
});

test('unpaid or incorrect-price sessions cannot grant access', async () => {
  const db = fakeDb(), restore = withStripe(db);
  try {
    const checkout = await worker.fetch(new Request('https://afterlife.test/api/checkout', { method: 'POST' }), env(db));
    const cookie = checkout.headers.get('set-cookie').split(';')[0];
    const session = stripeSession('cs_test_checkout1', db.entitlements[0].checkout_key);
    globalThis.fetch = async () => Response.json({ ...session, payment_status: 'unpaid' });
    const request = () => new Request('https://afterlife.test/api/checkout/verify?session_id=cs_test_checkout1', { headers: { cookie } });
    assert.equal((await (await worker.fetch(request(), env(db))).json()).entitled, false);
    globalThis.fetch = async () => Response.json({ ...session, line_items: { data: [{ price: { id: 'price_wrong' }, quantity: 1 }] } });
    assert.equal((await worker.fetch(request(), env(db))).status, 400);
    assert.equal(db.entitlements[0].state, 'pending');
  } finally { restore(); }
});
