const base = process.argv[2] || 'http://localhost:8787';
const read = async path => { const r = await fetch(new URL(path,base),{signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error(`${path}: HTTP ${r.status}`);return r.json(); };
const health = await read('/health');
if(health.status!=='live'||health.orchestration!=='configured'||health.storage!=='ready')throw Error('Live orchestration prerequisites missing');
const { runs }=await read('/api/runs');
console.log('Live service ready; Stripe:',health.billing,'; real runs:',runs.length);
if(runs[0]){const run=await read('/api/runs/'+runs[0].id);console.log('Latest run:',run.id,run.state,'; candidates:',run.candidates.length,'; stages:',run.stages.map(s=>`${s.kind}:${s.status}`).join(', '));if(run.product){const r=await fetch(new URL(run.product.url,base));if(!r.ok)throw Error('Product preview failed');console.log('Verified product URL:',new URL(run.product.url,base).href)}else console.log('Product not live yet; full pipeline verification pending.');}
