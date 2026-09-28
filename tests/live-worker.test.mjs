import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

test('live health exposes readiness but no credentials or fixed product', async()=>{
 const response=await worker.fetch(new Request('https://afterlife.test/health'),{BRAINBASE_TOKEN:'private-brainbase',STRIPE_SECRET_KEY:'sk_test_private',DB:{}});
 const body=await response.text();
 assert.equal(response.status,200);
 assert.equal(JSON.parse(body).orchestration,'configured');
 assert.doesNotMatch(body,/private|fpocket|DnaFeaturesViewer|PocketScan/);
});
test('old fixed-product APIs are absent from the public Worker',async()=>{
 for(const path of ['/api/status','/api/product/run','/api/checkout']){
  const response=await worker.fetch(new Request('https://afterlife.test'+path),{ASSETS:{fetch(){throw Error('Must not serve HTML for API')}}});
  assert.equal(response.status,404);
  assert.match(response.headers.get('content-type'),/json/);
 }
});
test('missing storage yields actionable JSON on product and billing routes',async()=>{
 for(const path of ['/p/11111111-1111-1111-1111-111111111111/','/api/runs/11111111-1111-1111-1111-111111111111/access']){
  const response=await worker.fetch(new Request('https://afterlife.test'+path),{});
  assert.equal(response.status,503);
  assert.match((await response.json()).error,/storage/);
 }
});
