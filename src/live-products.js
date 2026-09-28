import { validPreview } from './live-runs.js';
const json = (data, status = 200, headers = {}) => Response.json(data, { status, headers: { 'cache-control': 'no-store', ...headers } });
const hash = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), b => b.toString(16).padStart(2,'0')).join('');
function cookie(request, id) { return (request.headers.get('cookie') || '').split(';').map(s => s.trim()).find(s => s.startsWith(`al_${id}=`))?.split('=')[1]; }
async function purchase(request, env, id) {
  const token = cookie(request, id);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  return env.DB.prepare('SELECT * FROM product_purchases WHERE token_hash=?1 AND run_id=?2').bind(await hash(token), id).first();
}
async function stripe(env, path, body) {
  if (!['sk_test_', 'rk_test_', 'rkcs_test_'].some(p => env.STRIPE_SECRET_KEY?.startsWith(p))) throw Error('Stripe test billing is not configured');
  const response = await fetch(`https://api.stripe.com/v1/${path}`, { method: body ? 'POST' : 'GET', headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, ...(body ? { 'content-type': 'application/x-www-form-urlencoded' } : {}) }, ...(body ? { body: body.toString() } : {}), signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw Error(`Stripe returned ${response.status}`);
  return response.json();
}
export async function handleProductBilling(request, env, id, action) {
  try {
    const row = await env.DB.prepare('SELECT * FROM afterlife_runs WHERE id=?1').bind(id).first();
    const product = row?.snapshot ? JSON.parse(row.snapshot).product : null;
    if (!product || row.state !== 'live') return json({ error: 'This product is not live yet' }, 409);
    const url = new URL(request.url), owned = await purchase(request, env, id);
    if (action === 'access' && request.method === 'GET') return json({ entitled: owned?.state === 'paid' });
    if (action === 'payment' && request.method === 'GET') {
      const sessionId = url.searchParams.get('session_id');
      if (!owned || owned.session_id !== sessionId || !/^cs_test_[A-Za-z0-9]+$/.test(sessionId || '')) return json({ error: 'Checkout session does not belong to this browser' }, 403);
      const session = await stripe(env, `checkout/sessions/${sessionId}`);
      if (session.id !== owned.session_id || session.livemode !== false || session.mode !== 'payment' || session.metadata?.run_id !== id || session.metadata?.token_hash !== owned.token_hash || session.amount_total !== owned.amount || session.currency !== 'usd') return json({ error: 'Payment details do not match this product' }, 403);
      if (session.payment_status === 'paid') await env.DB.prepare("UPDATE product_purchases SET state='paid' WHERE token_hash=?1").bind(owned.token_hash).run();
      return json({ entitled: session.payment_status === 'paid' });
    }
    if (action !== 'checkout' || request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    if (request.headers.get('origin') && request.headers.get('origin') !== url.origin) return json({ error: 'Use the Afterlife product page' }, 403);
    if (owned?.state === 'paid') return json({ entitled: true, url: product.url });
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2,'0')).join(''), tokenHash = await hash(token);
    const amount = Math.round(Number(product.priceCents));
    if (!Number.isSafeInteger(amount) || amount < 100 || amount > 5000) throw Error('Product pricing is invalid');
    const form = new URLSearchParams({ mode: 'payment', 'payment_method_types[0]': 'card', 'line_items[0][price_data][currency]': 'usd', 'line_items[0][price_data][unit_amount]': String(amount), 'line_items[0][price_data][product_data][name]': `${product.name} — Afterlife test access`, 'line_items[0][quantity]': '1', success_url: `${url.origin}/product/?run=${id}&session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${url.origin}/product/?run=${id}&cancelled=1`, 'metadata[run_id]': id, 'metadata[token_hash]': tokenHash });
    const session = await stripe(env, 'checkout/sessions', form);
    if (session.livemode !== false || !session.id?.startsWith('cs_test_') || new URL(session.url).origin !== 'https://checkout.stripe.com') throw Error('Unexpected checkout response');
    await env.DB.prepare('INSERT INTO product_purchases(token_hash,run_id,session_id,amount,state,created_at) VALUES(?1,?2,?3,?4,\'pending\',?5)').bind(tokenHash, id, session.id, amount, Math.floor(Date.now()/1000)).run();
    return json({ url: session.url }, 200, { 'set-cookie': `al_${id}=${token}; Path=/; Max-Age=86400; HttpOnly; Secure; SameSite=Lax` });
  } catch (error) { return json({ error: error.message || 'Billing unavailable' }, 502); }
}
export async function proxyProduct(request, env) {
  const url = new URL(request.url), parts = url.pathname.split('/'), id = parts[2], path = '/' + parts.slice(3).join('/');
  if (!/^[a-f0-9-]{36}$/.test(id || '')) return json({ error: 'Product not found' }, 404);
  const row = await env.DB.prepare('SELECT * FROM afterlife_runs WHERE id=?1').bind(id).first();
  if (!row?.preview_url || row.state !== 'live') return json({ error: 'This temporary product is not available yet' }, 404);
  if (parts.length === 3) return Response.redirect(`${url.origin}/p/${id}/`, 302);
  if (path === '/checkout' || path === '/checkout/') return Response.redirect(`${url.origin}/product/?run=${id}`, 302);
  // The sandboxed product UI has an opaque origin. Public API requests are credential-free.
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type' };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (!['GET', 'HEAD', 'POST'].includes(request.method)) return json({ error: 'Method not allowed' }, 405, cors);
  // A temporary free preview remains usable; Stripe buys test access and demonstrates real per-product payment verification.
  if (request.method === 'POST' && path !== '/api/run') return json({ error: 'Unknown product action' }, 404, cors);
  const headers = { ...(request.headers.get('content-type') ? { 'content-type': request.headers.get('content-type') } : {}), ...(row.preview_token ? { [row.preview_header || 'x-preview-token']: row.preview_token } : {}) };
  let body;
  if (request.method === 'POST') {
    const reader = request.body?.getReader(); let size = 0; const chunks=[];
    if (reader) { try { while (true) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > 65536) { await reader.cancel(); return json({ error: 'Input too large' },413,cors); } chunks.push(value); } } finally { reader.releaseLock(); } }
    body = new Uint8Array(size); let offset=0; for (const c of chunks) { body.set(c,offset); offset+=c.byteLength; }
  }
  try {
    const base = validPreview(row.preview_url);
    const target = new URL(path + url.search, base);
    if (target.origin !== base.origin) return json({ error: 'Invalid product path' }, 400, cors);
    const upstream = await fetch(target, { method: request.method, headers, ...(body ? {body} : {}), redirect: 'manual', signal: AbortSignal.timeout(25000) });
    const responseHeaders = new Headers(cors);
    responseHeaders.set('content-type', upstream.headers.get('content-type') || 'application/octet-stream');
    responseHeaders.set('cache-control', 'no-store');
    responseHeaders.set('x-content-type-options', 'nosniff');
    responseHeaders.set('referrer-policy', 'no-referrer');
    if (responseHeaders.get('content-type').includes('text/html')) responseHeaders.set('content-security-policy', "sandbox allow-scripts allow-forms allow-downloads allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation; default-src 'none'; script-src 'unsafe-inline' " + url.origin + "; style-src 'unsafe-inline' " + url.origin + "; img-src data: blob: https:; connect-src " + url.origin + "; base-uri 'none'; form-action 'none'");
    if (upstream.status >= 300 && upstream.status < 400) return json({ error: 'Unexpected product redirect' },502,cors);
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch { return json({ error: 'Temporary preview is unavailable or asleep. Return to the console and refresh its status.' }, 503, cors); }
}
