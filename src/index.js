import { handleCheckout, handleVerify, handleWebhook, handleEntitlement, requireEntitlement } from './billing.js';

const json = (value, status = 200) => Response.json(value, { status, headers: { 'cache-control': 'no-store' } });

async function artifactHealth(env) {
  if (!env.CAPABILITY_BASE_URL) return { status: 'pending', error: 'No recovered artifact configured' };
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
    resurrection: { status: 'pending', error: 'No Person 1 resurrection handoff received' },
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
  try {
    const upstream = await fetch(new URL(env.CAPABILITY_RUN_PATH || '/run', base), {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body.input), signal: AbortSignal.timeout(20000)
    });
    if (!upstream.ok) return json({ success: false, error: `Recovered capability returned ${upstream.status}` }, 502);
    const result = await upstream.json();
    return json({ success: true, result, metadata: { repository: env.RECOVERED_REPOSITORY || null } });
  } catch (error) {
    console.error('Recovered capability failed:', error?.name || 'unknown');
    return json({ success: false, error: 'Recovered capability unavailable or timed out' }, 502);
  }
}

function page() {
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Afterlife · Recovered product</title>
<style>body{font:16px system-ui;max-width:760px;margin:5vh auto;padding:24px;color:#e8efe9;background:#101b1b}a{color:#9ce9c4}button{padding:12px 20px;cursor:pointer;background:#9ce9c4;border:0;border-radius:6px}button:disabled{opacity:.5}pre,textarea{background:#1c3030;color:#e8efe9;border:1px solid #49635b;border-radius:6px;padding:16px;max-width:100%;overflow:auto}textarea{width:95%;height:100px}small{color:#a4c2b6}.card{border:1px solid #49635b;border-radius:12px;padding:20px;margin:16px 0}</style>
<h1>Afterlife</h1><p>Neglected code, recovered as a real product.</p><div class="card"><h2 id="product">Recovered capability</h2><p id="repository">Waiting for a recovered artifact.</p><p id="artifact">Checking artifact…</p><p id="deployment"></p><p id="qa"></p></div>
<div class="card"><h2>Access</h2><p id="price">Checking Stripe test-mode price…</p><button id="buy" disabled>Buy test access</button><p id="payment"></p><small>Stripe test-mode transactions only. No real revenue is collected.</small></div>
<div class="card"><h2>Run the recovered software</h2><label for="input">Capability input (JSON)</label><textarea id="input">{}</textarea><p><button id="run" disabled>Run capability</button></p><pre id="result">Pay for access, then submit an input.</pre></div>
<script>
const $=id=>document.getElementById(id), format=v=>JSON.stringify(v,null,2);
async function get(url){let r=await fetch(url);return {status:r.status,data:await r.json()}}
async function load(){
try{
  let [{data:s},{data:e}]=await Promise.all([get('/api/status'),get('/api/entitlement')]);
  $('product').textContent=s.productName;
  $('repository').textContent=s.selectedRepository||'No selected repository handed off yet';
  $('artifact').textContent='Artifact: '+s.artifact.status+(s.artifact.error?' — '+s.artifact.error:'');
  $('deployment').textContent='Worker: '+s.deployment.status+(s.deployment.productionUrl?' — '+s.deployment.productionUrl:'');
  $('qa').textContent='Independent QA: '+s.qa.status;
  const money=new Intl.NumberFormat(undefined,{style:'currency',currency:s.stripe.currency||'USD'});
  const divisor=10**money.resolvedOptions().maximumFractionDigits;
  $('price').textContent=s.stripe.status==='ready'?'One-time Stripe test price: '+money.format(s.stripe.amount/divisor):'Billing: '+s.stripe.status+(s.stripe.error?' — '+s.stripe.error:'');
  $('buy').disabled=s.stripe.status!=='ready';
  $('payment').textContent=e.entitled?'Verified paid access':'No verified paid access';
  $('run').disabled=!e.entitled||s.artifact.status!=='ready';
}catch(_){$('payment').textContent='Cannot reach the service. Retry by refreshing.'}
}
$('buy').onclick=async()=>{ $('buy').disabled=true;try{let r=await fetch('/api/checkout',{method:'POST'}),d=await r.json();if(!r.ok||!d.url)throw Error(d.error||'Checkout unavailable');location.assign(d.url)}catch(e){$('payment').textContent=e.message;$('buy').disabled=false}};
$('run').onclick=async()=>{try{let input=JSON.parse($('input').value);$('result').textContent='Running…';let r=await fetch('/api/product/run',{method:'POST',headers:{'content-type':'application/json'},body:format({input})});$('result').textContent=format(await r.json())}catch(e){$('result').textContent='Invalid JSON input or connection error: '+e.message}};
load();
</script></html>`, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
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
    if ((path === '/product' || path === '/product/') && method === 'GET') return page();
    if (env.ASSETS && (method === 'GET' || method === 'HEAD')) return env.ASSETS.fetch(request);
    return json({ error: 'Not found' }, 404);
  }
};
export default worker;
