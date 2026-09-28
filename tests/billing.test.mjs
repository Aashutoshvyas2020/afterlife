import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { createHmac } from 'node:crypto';

const envBase = {
  STRIPE_SECRET_KEY: 'sk_test_regression',
  STRIPE_PRICE_ID: 'price_regression',
  STRIPE_WEBHOOK_SECRET: 'whsec_regression',
};

function fakeDb() {
  const entitlements = [];
  const events = new Set();
  function statement(sql, values = []) {
    const query = {
      bind(...bound) { return statement(sql, bound); },
      async run() {
        if (sql.includes('INSERT INTO billing_entitlements')) {
          entitlements.push({ token_hash: values[0], checkout_key: values[1], checkout_session_id: null, state: 'pending' });
        } else if (sql.includes('UPDATE billing_entitlements SET checkout_session_id')) {
          const row = entitlements.find(item => item.checkout_key === values[1]);
          if (row && (row.checkout_session_id == null || row.checkout_session_id === values[0])) row.checkout_session_id = values[0];
        } else if (sql.includes("UPDATE billing_entitlements SET state = 'paid'")) {
          const row = entitlements.find(item => item.token_hash === values[1] && item.checkout_session_id === values[2]);
          if (row) row.state = 'paid';
        } else if (sql.includes('UPDATE billing_entitlements') && sql.includes('COALESCE(checkout_session_id')) {
          const row = entitlements.find(item => item.checkout_key === values[2] && (item.checkout_session_id == null || item.checkout_session_id === values[0]));
          if (row) { row.checkout_session_id ??= values[0]; row.state = 'paid'; }
        } else if (sql.includes('INSERT INTO stripe_events')) {
          events.add(values[0]);
        }
        return { success: true };
      },
      async first() {
        if (sql.includes('SELECT checkout_session_id')) return entitlements.find(item => item.checkout_key === values[0]) ?? null;
        if (sql.includes('SELECT state') && sql.includes('checkout_session_id')) return entitlements.find(item => item.token_hash === values[0] && item.checkout_session_id === values[1]) ?? null;
        if (sql.includes('SELECT state')) return entitlements.find(item => item.token_hash === values[0]) ?? null;
        if (sql.includes('SELECT event_id')) return events.has(values[0]) ? { event_id: values[0] } : null;
        return null;
      },
    };
    return query;
  }
  return {
    entitlements,
    prepare: sql => statement(sql),
    async batch(queries) { for (const query of queries) await query.run(); },
  };
}

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
    if (url.pathname.endsWith('/prices/' + envBase.STRIPE_PRICE_ID)) {
      return Response.json({ id: envBase.STRIPE_PRICE_ID, livemode: false, active: true, type: 'one_time' });
    }
    if (url.pathname.endsWith('/checkout/sessions') && init.method === 'POST') {
      assert.equal(new URLSearchParams(init.body).get('payment_method_types[0]'), 'card');
      return Response.json({ id: 'cs_test_checkout1', mode: 'payment', livemode: false, url: 'https://checkout.stripe.test/session' });
    }
    const match = url.pathname.match(/\/checkout\/sessions\/(cs_test_[A-Za-z0-9]+)$/);
    if (match && sessions[match[1]]) return Response.json(sessions[match[1]]);
    return Response.json({ error: 'unexpected Stripe request' }, { status: 404 });
  };
  return () => { globalThis.fetch = originalFetch; };
}

function env(db) { return { ...envBase, DB: db }; }

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
