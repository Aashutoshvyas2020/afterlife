import { handleRuns, scheduledRefresh } from './live-runs.js';
import { handleProductBilling, proxyProduct } from './live-products.js';
const json = (data, status = 200) => Response.json(data, {status,headers:{'cache-control':'no-store'}});
const worker = {
 async scheduled(event, env, ctx) { ctx.waitUntil(scheduledRefresh(env)); },
 async fetch(request, env) {
  const { pathname: path } = new URL(request.url), method = request.method;
  try {
   if (path === '/health' && method === 'GET') return json({ status:'live', service:'afterlife', orchestration:env.BRAINBASE_TOKEN?'configured':'pending', storage:env.DB?'ready':'pending', billing:['sk_test_','rk_test_','rkcs_test_'].some(p=>env.STRIPE_SECRET_KEY?.startsWith(p))?'test':'pending' });
   if (path.startsWith('/p/')) return env.DB ? proxyProduct(request,env) : json({error:'Product storage is not configured'},503);
   const action = path.match(/^\/api\/runs\/([a-f0-9-]{36})\/(checkout|payment|access)$/);
   if (action) return env.DB ? handleProductBilling(request,env,action[1],action[2]) : json({error:'Billing storage is not configured'},503);
   if (path === '/api/runs' || /^\/api\/runs\/[a-f0-9-]{36}$/.test(path)) return handleRuns(request,env);
   if (path.startsWith('/api/') || path === '/health') return json({error:'Unknown endpoint or unsupported method'},404);
   if (env.ASSETS && ['GET','HEAD'].includes(method)) return env.ASSETS.fetch(request);
   return json({error:'Not found'},404);
  } catch { return json({error:'The service is temporarily unavailable. Please retry.'},503); }
 }
};

export default worker;
