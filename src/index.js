import { readJson } from './request-body.js';
import { handoff } from './handoff.js';
import { handleCheckout, handleVerify, handleWebhook, handleEntitlement, requireEntitlement } from './billing.js';

const json = (value, status = 200) => Response.json(value, { status, headers: { 'cache-control': 'no-store' } });

function capabilityUrl(env, path) {
  const base = new URL(env.CAPABILITY_BASE_URL);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
  if (base.protocol !== 'https:' && !(base.protocol === 'http:' && local)) throw Error('Artifact URL must be HTTPS');
  const target = new URL(path, base);
  if (target.origin !== base.origin || target.username || target.password) throw Error('Invalid artifact path');
  return target;
}
function capabilityHeaders(env) {
  return { 'content-type': 'application/json', ...(env.CAPABILITY_TOKEN ? { authorization: `Bearer ${env.CAPABILITY_TOKEN}` } : {}) };
}
async function artifactHealth(env) {
  if (!env.CAPABILITY_BASE_URL) return { status: 'pending', error: 'No recovered artifact configured' };
  try {
    const response = await fetch(capabilityUrl(env, env.CAPABILITY_HEALTH_PATH || '/health'), { headers: capabilityHeaders(env), signal: AbortSignal.timeout(5000), redirect: 'manual' });
    if (!response.ok) return { status: 'failed', error: `Artifact health returned ${response.status}` };
    const health = await response.json();
    return health.status === 'ready' && health.capability === 'dna-feature-map'
      ? { status: 'ready' } : { status: 'failed', error: 'Endpoint is not the DNA feature-map renderer' };
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
    if (price.id !== env.STRIPE_PRICE_ID || !price.active || price.livemode || price.type !== 'one_time' || !price.unit_amount || !price.currency) return { status: 'failed', error: 'Expected an active one-time test price' };
    return { status: 'ready', mode: 'test', priceId: price.id, amount: price.unit_amount, currency: price.currency.toUpperCase() };
  } catch { return { status: 'failed', error: 'Stripe price lookup failed' }; }
}

async function status(request, env) {
  const origin = new URL(request.url);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname);
  const [artifact, billing] = await Promise.all([artifactHealth(env), pricing(env)]);
  return {
    selectedRepository: env.RECOVERED_REPOSITORY || handoff.repository,
    productName: env.PRODUCT_NAME || handoff.productName,
    resurrection: !env.RECOVERED_REPOSITORY || env.RECOVERED_REPOSITORY === handoff.repository
      ? { status: 'ready', ...handoff }
      : { status: 'pending', detail: 'No verified handoff for the configured repository' },
    artifact,
    deployment: { status: 'live', scope: local ? 'local' : 'public', productionUrl: origin.origin },
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
    base = capabilityUrl(env, env.CAPABILITY_RUN_PATH || '/run');
  } catch { return json({ success: false, error: 'Recovered artifact URL is invalid' }, 503); }
  let body;
  try {
    body = await readJson(request);
    if (!body || typeof body !== 'object' || Array.isArray(body) || !Object.hasOwn(body, 'input')) throw Error('invalid input');
  } catch (error) { return json({ success: false, error: error instanceof RangeError ? 'Input too large' : 'Expected JSON object with input' }, error instanceof RangeError ? 413 : 400); }
  try {
    const upstream = await fetch(base, {
      method: 'POST', headers: capabilityHeaders(env), body: JSON.stringify(body.input), signal: AbortSignal.timeout(20000), redirect: 'manual'
    });
    if (upstream.status === 400 || upstream.status === 413) {
      const detail = await upstream.json().catch(() => ({}));
      return json({ success: false, error: typeof detail.error === 'string' ? detail.error.slice(0, 250) : 'Invalid feature-map input' }, upstream.status);
    }
    if (!upstream.ok) return json({ success: false, error: `Recovered capability returned ${upstream.status}` }, 502);
    const result = await upstream.json();
    if (result?.mime_type !== 'image/png' || typeof result.image_base64 !== 'string' || !result.image_base64.startsWith('iVBORw0KGgo') || result.image_base64.length > 2000000 || !/^[a-f0-9]{64}$/.test(result.sha256 || '') || !Number.isInteger(result.sequence_length) || !Number.isInteger(result.feature_count)) {
      return json({ success: false, error: 'Renderer returned an invalid feature map' }, 502);
    }
    return json({ success: true, result, metadata: { repository: env.RECOVERED_REPOSITORY || handoff.repository } });
  } catch (error) {
    console.error('Recovered capability failed:', error?.name || 'unknown');
    return json({ success: false, error: 'Recovered capability unavailable or timed out' }, 502);
  }
}

const worker = {
  async fetch(request, env) {
    const url = new URL(request.url), path = url.pathname, method = request.method;
    if (path === '/health' && method === 'GET') return json({ status: 'live', service: 'afterlife', artifact: await artifactHealth(env) });
    if (path === '/api/status' && method === 'GET') return json(await status(request, env));
    if (path === '/api/checkout' && method === 'POST') {
      const artifact = await artifactHealth(env);
      if (artifact.status !== 'ready') return json({ success: false, error: 'Checkout is unavailable until the renderer is connected' }, 503);
      return handleCheckout(request, env);
    }
    if (path === '/api/checkout/verify' && method === 'GET') return handleVerify(request, env);
    if (path === '/api/stripe/webhook' && method === 'POST') return handleWebhook(request, env);
    if (path === '/api/entitlement' && method === 'GET') return handleEntitlement(request, env);
    if (path === '/api/product/run' && method === 'POST') return run(request, env);
    if (path.startsWith('/api/') || path === '/health') return json({ error: 'Unknown endpoint or unsupported method' }, 404);
    if (env.ASSETS && (method === 'GET' || method === 'HEAD')) return env.ASSETS.fetch(request);
    return json({ error: 'Not found' }, 404);
  }
};
export default worker;
