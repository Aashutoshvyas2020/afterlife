import { handleCheckout, handleVerify, handleWebhook, handleEntitlement, requireEntitlement } from './billing.js';

const json = (value, status = 200) => Response.json(value, { status, headers: { 'cache-control': 'no-store' } });

async function artifactHealth(env) {
  if (!env.CAPABILITY_BASE_URL) return { status: 'pending', error: 'Recovered capability service URL is not configured' };
  try {
    const base = new URL(env.CAPABILITY_BASE_URL);
    if (base.protocol !== 'https:' && base.hostname !== 'localhost') throw Error('Artifact URL must be HTTPS');
    const response = await fetch(new URL(env.CAPABILITY_HEALTH_PATH || '/health', base), { signal: AbortSignal.timeout(5000) });
    return response.ok ? { status: 'ready' } : { status: 'failed', error: `Artifact health returned ${response.status}` };
  } catch {
    return { status: 'failed', error: 'Artifact health check failed' };
  }
}

async function pricing(env) {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PRICE_ID || !env.STRIPE_WEBHOOK_SECRET || !env.DB) return { status: 'pending' };
  if (!['sk_test_', 'rk_test_', 'rkcs_test_'].some(prefix => env.STRIPE_SECRET_KEY.startsWith(prefix)) || !env.STRIPE_PRICE_ID.startsWith('price_') || env.STRIPE_PRICE_ID.includes('REPLACE') || !env.STRIPE_WEBHOOK_SECRET.startsWith('whsec_')) return { status: 'failed', error: 'Test-mode billing configuration required' };
  try {
    const response = await fetch(`https://api.stripe.com/v1/prices/${encodeURIComponent(env.STRIPE_PRICE_ID)}`, {
      headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}` }, signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) return { status: 'failed', error: `Stripe price lookup returned ${response.status}` };
    const price = await response.json();
    if (!price.active || price.livemode || price.type !== 'one_time' || !price.unit_amount || !price.currency) return { status: 'failed', error: 'Expected an active one-time test price' };
    return { status: 'ready', mode: 'test', priceId: price.id, amount: price.unit_amount, currency: price.currency.toUpperCase() };
  } catch { return { status: 'failed', error: 'Stripe price lookup failed' }; }
}

async function status(env) {
  const [artifact, billing] = await Promise.all([artifactHealth(env), pricing(env)]);
  return {
    selectedRepository: env.RECOVERED_REPOSITORY || null,
    productName: env.PRODUCT_NAME || 'Recovered capability',
    resurrection: env.RECOVERED_REPOSITORY === 'Edinburgh-Genome-Foundry/DnaFeaturesViewer' && env.RECOVERED_SOURCE_REVISION === '049bbe4e3063e90ae9b0f88ac7e92f47b735d38a'
      ? { status: 'ready', decision: 'FUND', sourceRevision: env.RECOVERED_SOURCE_REVISION }
      : { status: 'pending', error: 'No verified Person 1 recovery handoff is configured' },
    artifact,
    deployment: { status: 'live', productionUrl: env.PUBLIC_URL || null },
    stripe: billing,
    qa: { status: 'pending', detail: 'Independent full-product QA not recorded' },
    latestError: (artifact.status === 'failed' && artifact.error) || (billing.status === 'failed' && billing.error) || null
  };
}

async function run(request, env) {
  if (!await requireEntitlement(request, env)) return json({ success: false, error: 'Verified test payment required' }, 403);
  if (!env.CAPABILITY_BASE_URL) return json({ success: false, error: 'Recovered artifact is not configured' }, 503);
  let base;
  try {
    base = new URL(env.CAPABILITY_BASE_URL);
    if (base.protocol !== 'https:' && base.hostname !== 'localhost') throw Error('invalid artifact URL');
  } catch { return json({ success: false, error: 'Recovered artifact URL is invalid' }, 503); }
  let body;
  try {
    const text = await request.text();
    if (text.length > 32768) return json({ success: false, error: 'Input too large' }, 413);
    body = JSON.parse(text);
    if (!body || typeof body !== 'object' || Array.isArray(body) || !Object.hasOwn(body, 'input')) throw Error('invalid input');
  } catch { return json({ success: false, error: 'Expected JSON object with input' }, 400); }
  if (!env.CAPABILITY_AUTH_TOKEN) return json({ success: false, error: 'Recovered capability authentication is not configured' }, 503);
  try {
    const upstream = await fetch(new URL(env.CAPABILITY_RUN_PATH || '/run', base), {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${env.CAPABILITY_AUTH_TOKEN}` }, body: JSON.stringify(body.input), signal: AbortSignal.timeout(20000)
    });
    if (!upstream.ok) return json({ success: false, error: `Recovered capability returned ${upstream.status}` }, 502);
    const result = await upstream.json();
    return json({ success: true, result, metadata: { repository: env.RECOVERED_REPOSITORY || null } });
  } catch (error) {
    console.error('Recovered capability failed:', error?.name || 'unknown');
    return json({ success: false, error: 'Recovered capability unavailable or timed out' }, 502);
  }
}

const worker = {
  async fetch(request, env) {
    const url = new URL(request.url), path = url.pathname, method = request.method;
    if (path === '/health' && method === 'GET') return json({ status: 'live', service: 'afterlife', artifact: await artifactHealth(env) });
    if (path === '/api/status' && method === 'GET') return json(await status(env));
    if (path === '/api/checkout' && method === 'POST') return handleCheckout(request, env);
    if (path === '/api/checkout/verify' && method === 'GET') return handleVerify(request, env);
    if (path === '/api/stripe/webhook' && method === 'POST') return handleWebhook(request, env);
    if (path === '/api/entitlement' && method === 'GET') return handleEntitlement(request, env);
    if (path === '/api/product/run' && method === 'POST') return run(request, env);
    if ((path === '/product' || path === '/product/') && method === 'GET') return Response.redirect(new URL('/', request.url), 302);
    if (env.ASSETS && (method === 'GET' || method === 'HEAD')) return env.ASSETS.fetch(request);
    return json({ error: 'Not found' }, 404);
  }
};
export default worker;
