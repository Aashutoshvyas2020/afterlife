const COOKIE_NAME = 'afterlife_access';
const STRIPE_API = 'https://api.stripe.com/v1';
const SIGNATURE_TOLERANCE_SECONDS = 300;
const TOKEN_MAX_AGE_SECONDS = 31_536_000;

function json(data, status = 200, extraHeaders = {}) {
  return Response.json(data, {
    status,
    headers: { 'cache-control': 'no-store', ...extraHeaders },
  });
}

function failure(status, error) {
  return json({ success: false, error }, status);
}

function logFailure(area) {
  console.error(`billing: ${area} failed`);
}

function hasDb(env) {
  return env?.DB && typeof env.DB.prepare === 'function';
}

function hasStripeConfig(env, includeWebhook = false) {
  const stripeKey = env?.STRIPE_SECRET_KEY;
  return typeof stripeKey === 'string'
    && ['sk_test_', 'rk_test_', 'rkcs_test_'].some(prefix => stripeKey.startsWith(prefix))
    && !stripeKey.includes('REPLACE')
    && typeof env.STRIPE_PRICE_ID === 'string'
    && env.STRIPE_PRICE_ID.startsWith('price_')
    && !env.STRIPE_PRICE_ID.includes('REPLACE')
    && (!includeWebhook || (typeof env.STRIPE_WEBHOOK_SECRET === 'string'
      && env.STRIPE_WEBHOOK_SECRET.startsWith('whsec_')
      && !env.STRIPE_WEBHOOK_SECRET.includes('REPLACE')));
}

function cookieValue(request) {
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0 || part.slice(0, separator).trim() !== COOKIE_NAME) continue;
    const token = part.slice(separator + 1).trim();
    return /^[a-f0-9]{64}$/.test(token) ? token : null;
  }
  return null;
}

function randomHex(size = 32) {
  const bytes = crypto.getRandomValues(new Uint8Array(size));
  let result = '';
  for (const byte of bytes) result += byte.toString(16).padStart(2, '0');
  return result;
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function checkoutOrigin(request) {
  const url = new URL(request.url);
  const localHttp = url.protocol === 'http:'
    && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !localHttp) || url.username || url.password) return null;
  return url.origin;
}

async function stripeRequest(env, path, init = {}) {
  const response = await fetch(`${STRIPE_API}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      ...(init.body ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
      ...init.headers,
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error('Stripe request failed');
  return response.json();
}

async function getPrice(env) {
  return stripeRequest(env, `/prices/${encodeURIComponent(env.STRIPE_PRICE_ID)}`);
}

async function getCheckoutSession(env, sessionId) {
  const query = new URLSearchParams();
  query.append('expand[]', 'line_items');
  return stripeRequest(env, `/checkout/sessions/${encodeURIComponent(sessionId)}?${query}`);
}

function hasExpectedPrice(session, env) {
  const items = session?.line_items?.data;
  return Array.isArray(items)
    && items.length === 1
    && items[0]?.price?.id === env.STRIPE_PRICE_ID
    && items[0]?.quantity === 1;
}

function isExpectedTestSession(session, env) {
  return session?.mode === 'payment'
    && session?.livemode === false
    && hasExpectedPrice(session, env);
}

async function readEntitlement(env, tokenHash) {
  return env.DB.prepare(
    'SELECT state FROM billing_entitlements WHERE token_hash = ?1 LIMIT 1',
  ).bind(tokenHash).first();
}

function cookieHeader(token) {
  return `${COOKIE_NAME}=${token}; Max-Age=${TOKEN_MAX_AGE_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

export async function handleCheckout(request, env) {
  if (!hasDb(env) || !hasStripeConfig(env)) return failure(503, 'Billing is not configured');
  const origin = checkoutOrigin(request);
  if (!origin) return failure(400, 'A secure checkout origin is required');

  let token;
  let tokenHash;
  let checkoutKey;
  try {
    token = randomHex();
    tokenHash = await sha256Hex(token);
    checkoutKey = randomHex();
    await env.DB.prepare(
      `INSERT INTO billing_entitlements (token_hash, checkout_key, checkout_session_id, state, created_at)
       VALUES (?1, ?2, NULL, 'pending', ?3)`,
    ).bind(tokenHash, checkoutKey, Math.floor(Date.now() / 1000)).run();

    const price = await getPrice(env);
    if (price.id !== env.STRIPE_PRICE_ID || price.livemode !== false
        || price.active !== true || price.type !== 'one_time') {
      logFailure('test price validation');
      return failure(503, 'Test billing price is unavailable');
    }

    const form = new URLSearchParams();
    form.set('mode', 'payment');
    form.set('payment_method_types[0]', 'card');
    form.set('line_items[0][price]', env.STRIPE_PRICE_ID);
    form.set('line_items[0][quantity]', '1');
    form.set('success_url', `${origin}/checkout/success/?session_id={CHECKOUT_SESSION_ID}`);
    form.set('cancel_url', `${origin}/checkout/cancelled/`);
    form.set('metadata[checkout_key]', checkoutKey);
    const session = await stripeRequest(env, '/checkout/sessions', {
      method: 'POST',
      body: form.toString(),
    });
    if (typeof session.id !== 'string' || !session.id.startsWith('cs_test_')
        || session.mode !== 'payment' || session.livemode !== false
        || typeof session.url !== 'string') {
      logFailure('test checkout session validation');
      return failure(502, 'Checkout could not be created');
    }

    await env.DB.prepare(
      `UPDATE billing_entitlements SET checkout_session_id = ?1
       WHERE checkout_key = ?2 AND (checkout_session_id IS NULL OR checkout_session_id = ?1)`,
    ).bind(session.id, checkoutKey).run();
    const stored = await env.DB.prepare(
      'SELECT checkout_session_id FROM billing_entitlements WHERE checkout_key = ?1 LIMIT 1',
    ).bind(checkoutKey).first();
    if (stored?.checkout_session_id !== session.id) {
      logFailure('checkout persistence');
      return failure(503, 'Checkout could not be saved');
    }

    return json({ success: true, url: session.url }, 200, {
      'set-cookie': cookieHeader(token),
    });
  } catch {
    logFailure('checkout');
    return failure(502, 'Checkout could not be created');
  }
}

export async function handleVerify(request, env) {
  if (!hasDb(env) || !hasStripeConfig(env)) return failure(503, 'Billing is not configured');
  const token = cookieValue(request);
  const sessionId = new URL(request.url).searchParams.get('session_id');
  if (!token || !sessionId || !/^cs_test_[A-Za-z0-9]+$/.test(sessionId)) {
    return json({ success: false, entitled: false, error: 'Checkout session could not be verified' }, 400);
  }

  try {
    const tokenHash = await sha256Hex(token);
    const ownedSession = await env.DB.prepare(
      `SELECT state FROM billing_entitlements
       WHERE token_hash = ?1 AND checkout_session_id = ?2 LIMIT 1`,
    ).bind(tokenHash, sessionId).first();
    if (!ownedSession) {
      return json({ success: false, entitled: false, error: 'Checkout session could not be verified' }, 403);
    }

    const session = await getCheckoutSession(env, sessionId);
    if (session.id !== sessionId || !isExpectedTestSession(session, env)) {
      return json({ success: false, entitled: false, error: 'Checkout session could not be verified' }, 400);
    }
    if (session.payment_status !== 'paid') {
      return json({ success: true, entitled: false, error: 'Payment is not complete' }, 200);
    }

    await env.DB.prepare(
      `UPDATE billing_entitlements SET state = 'paid', paid_at = COALESCE(paid_at, ?1)
       WHERE token_hash = ?2 AND checkout_session_id = ?3`,
    ).bind(Math.floor(Date.now() / 1000), tokenHash, sessionId).run();
    const entitlement = await readEntitlement(env, tokenHash);
    return json({ success: true, entitled: entitlement?.state === 'paid' });
  } catch {
    logFailure('checkout verification');
    return json({ success: false, entitled: false, error: 'Payment verification is unavailable' }, 502);
  }
}

function equalBytes(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

async function validStripeSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader) return false;
  let timestamp = null;
  const signatures = [];
  for (const item of signatureHeader.split(',')) {
    const separator = item.indexOf('=');
    if (separator < 1) continue;
    const key = item.slice(0, separator).trim();
    const value = item.slice(separator + 1).trim();
    if (key === 't') {
      if (timestamp !== null || !/^\d+$/.test(value)) return false;
      timestamp = Number(value);
    } else if (key === 'v1' && /^[a-f0-9]{64}$/i.test(value)) {
      signatures.push(value);
    }
  }
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(timestamp) || Math.abs(now - timestamp) > SIGNATURE_TOLERANCE_SECONDS || signatures.length === 0) {
    return false;
  }
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const digest = new Uint8Array(await crypto.subtle.sign(
    'HMAC', key, new TextEncoder().encode(`${timestamp}.${rawBody}`),
  ));
  return signatures.some(signature => {
    const supplied = new Uint8Array(signature.match(/.{2}/g).map(byte => Number.parseInt(byte, 16)));
    return equalBytes(digest, supplied);
  });
}

async function recordStripeEvent(env, eventId) {
  await env.DB.prepare(
    'INSERT INTO stripe_events (event_id, received_at) VALUES (?1, ?2) ON CONFLICT(event_id) DO NOTHING',
  ).bind(eventId, Math.floor(Date.now() / 1000)).run();
}

async function eventAlreadyRecorded(env, eventId) {
  return Boolean(await env.DB.prepare(
    'SELECT event_id FROM stripe_events WHERE event_id = ?1 LIMIT 1',
  ).bind(eventId).first());
}

export async function handleWebhook(request, env) {
  if (!hasDb(env) || !hasStripeConfig(env, true)) return failure(503, 'Billing is not configured');
  let rawBody;
  let event;
  try {
    rawBody = await request.text();
    if (!await validStripeSignature(rawBody, request.headers.get('stripe-signature'), env.STRIPE_WEBHOOK_SECRET)) {
      return failure(400, 'Invalid webhook signature');
    }
    event = JSON.parse(rawBody);
  } catch {
    return failure(400, 'Invalid webhook payload');
  }
  if (typeof event?.id !== 'string' || !event.id.startsWith('evt_')) {
    return failure(400, 'Invalid webhook payload');
  }

  try {
    if (await eventAlreadyRecorded(env, event.id)) return json({ success: true, received: true });
    if (event.type !== 'checkout.session.completed') {
      await recordStripeEvent(env, event.id);
      return json({ success: true, received: true });
    }

    const eventSession = event.data?.object;
    const checkoutKey = eventSession?.metadata?.checkout_key;
    const eventSessionId = eventSession?.id;
    if (typeof checkoutKey !== 'string' || !/^[a-f0-9]{64}$/.test(checkoutKey)
        || typeof eventSessionId !== 'string' || !eventSessionId.startsWith('cs_test_')) {
      await recordStripeEvent(env, event.id);
      return json({ success: true, received: true });
    }

    const session = await getCheckoutSession(env, eventSessionId);
    const matchesEvent = session.id === eventSessionId
      && eventSession.livemode === false
      && eventSession.mode === 'payment'
      && eventSession.payment_status === 'paid'
      && session.livemode === false
      && session.payment_status === 'paid'
      && isExpectedTestSession(session, env)
      && session.metadata?.checkout_key === checkoutKey;
    if (!matchesEvent) {
      await recordStripeEvent(env, event.id);
      return json({ success: true, received: true });
    }

    await env.DB.batch([
      env.DB.prepare(
        'INSERT INTO stripe_events (event_id, received_at) VALUES (?1, ?2) ON CONFLICT(event_id) DO NOTHING',
      ).bind(event.id, Math.floor(Date.now() / 1000)),
      env.DB.prepare(
        `UPDATE billing_entitlements
         SET checkout_session_id = COALESCE(checkout_session_id, ?1),
             state = 'paid', paid_at = COALESCE(paid_at, ?2)
         WHERE checkout_key = ?3 AND (checkout_session_id IS NULL OR checkout_session_id = ?1)`,
      ).bind(session.id, Math.floor(Date.now() / 1000), checkoutKey),
    ]);
    return json({ success: true, received: true });
  } catch {
    logFailure('webhook processing');
    return failure(503, 'Webhook processing is unavailable');
  }
}

export async function requireEntitlement(request, env) {
  if (!hasDb(env)) return false;
  const token = cookieValue(request);
  if (!token) return false;
  try {
    const entitlement = await readEntitlement(env, await sha256Hex(token));
    return entitlement?.state === 'paid';
  } catch {
    logFailure('entitlement lookup');
    return false;
  }
}

export async function handleEntitlement(request, env) {
  const entitled = await requireEntitlement(request, env);
  return json({ success: true, entitled });
}
