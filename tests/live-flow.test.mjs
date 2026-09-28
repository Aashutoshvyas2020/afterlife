import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import agents from '../agents/live-config.json' with { type: 'json' };
import { parseAgentResult, taskMessages, validPreview, handleRuns, getRun, recoverHandoff, recoverBootstrap, normalizeAgentTime, isAgentNarration } from '../src/live-runs.js';
import { proxyProduct, handleProductBilling } from '../src/live-products.js';

const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const product = { name: 'Recovered tool', repository: 'org/repo', priceCents: 500, url: `/p/${id}/` };
function database(row, owned = null) {
  const writes = [];
  return { writes, prepare(sql) { return { bind(...args) { return {
    async first() { return sql.includes('product_purchases') ? owned : row; },
    async run() {
      writes.push({ sql, args });
      if (row && sql.startsWith('UPDATE afterlife_runs SET preview_url=')) row.preview_url = args[0];
      if (row && sql.startsWith('UPDATE afterlife_runs SET state=?1,snapshot=')) { row.state = args[0]; row.snapshot = args[1]; row.updated_at = args[2]; }
      return { meta: { changes: 1 } };
    },
  }; } }; } };
}
const live = () => ({ id, state: 'live', preview_url: 'https://preview.brainbaselabs.space', preview_token: 'private-preview-test-token', snapshot: JSON.stringify({ product }) });

test('agent result handles actual assistant JSON and ignores tools', () => {
  assert.deepEqual(parseAgentResult([{ role: 'assistant', content: '```json\n{"decision":"FUND"}\n```' }, { role: 'tool', content: '{"decision":"PASS_ALL"}' }]), { decision: 'FUND' });
  assert.equal(parseAgentResult([{ role: 'assistant', content: '[]' }]), null);
});

test('preview host rejects deceptive hosts, credentials, and HTTP', () => {
  assert.equal(validPreview('https://x.brainbaselabs.space/a').hostname, 'x.brainbaselabs.space');
  for (const url of ['https://brainbaselabs.space.attacker.test', 'https://x.brainbaselabs.space@attacker.test', 'http://x.brainbaselabs.space', 'https://127.0.0.1']) assert.throws(() => validPreview(url));
});

test('malformed live-run requests return client errors without starting agents', async t => {
  t.mock.method(globalThis, 'fetch', () => { throw Error('No external call expected'); });
  const response = await handleRuns(new Request('https://afterlife.test/api/runs', { method: 'POST', body: '{broken' }), { DB: {}, BRAINBASE_TOKEN: 'test' });
  assert.equal(response.status, 400);
});

test('provider healthok alone cannot launch; source and real execution must verify', async t => {
  const row = { id, thesis: 'A real opportunity', state: 'running', root_task_id: 'task0', created_at: 0, updated_at: 0 };
  const DB = database(row);
  let repository = 'wrong/repo', executions = 0, executionHealthy = false, hasExample = false;
  t.mock.method(globalThis, 'fetch', async (input, init) => {
    const url = new URL(input);
    if (url.hostname.endsWith('.brainbaselabs.space')) {
      if (url.pathname === '/api/run') {
        executions++;
        assert.equal(init.method, 'POST');
        assert.deepEqual(JSON.parse(init.body), { input: { text: 'real example' } });
        return executionHealthy ? Response.json({ success: true, result: 'computed result' }) : Response.json({ error: 'Broken adapter' }, { status: 500 });
      }
      return Response.json(url.pathname === '/health' ? { status: 'ok' } : { ...product, repository, sourceRevision: 'a'.repeat(40), priceCents: 500.4, ...(hasExample ? { exampleInput: { text: 'real example' } } : {}) });
    }
    if (url.pathname.includes('/machines/')) return Response.json({ url: 'https://preview.brainbaselabs.space' });
    const tasks = ['scout', 'investment', 'resurrection', 'product'].map((kind, i) => ({ id: `task${i}`, agent_id: agents[kind], status: 'success', machine_id: 'machine', created_at: new Date().toISOString() }));
    if (url.searchParams.has('parent_task_id')) {
      const index = Number(url.searchParams.get('parent_task_id').slice(-1));
      return Response.json({ items: tasks.slice(index + 1, index + 2) });
    }
    const index = Number(url.pathname.match(/task(\d)/)?.[1]);
    if (url.pathname.endsWith('/messages')) {
      const results = [{ candidates: [{ repository: 'org/repo', neglect_evidence: ['Old release', 'Open issue'], technical_risks: ['Dependency version', 'Small maintainer pool'] }] }, { decision: 'FUND', repository: 'org/repo' }, { status: 'READY', repository: 'org/repo', sourceRevision: 'a'.repeat(40) }, { status: 'READY' }];
      return Response.json({ items: [{ role: 'assistant', content: JSON.stringify(results[index]) }] });
    }
    return Response.json(tasks[index]);
  });
  const env = { DB, BRAINBASE_TOKEN: 'test' };
  const rejected = await getRun(env, id, true);
  assert.equal(rejected.state, 'running');
  assert.equal(rejected.product, null);
  assert.match(rejected.error, /health check/);
  repository = 'org/repo';
  assert.equal((await getRun(env, id, true)).state, 'running', 'Missing example input must block readiness');
  assert.equal(executions, 0);
  hasExample = true;
  assert.equal((await getRun(env, id, true)).state, 'running', 'An API returning 500 must block readiness');
  assert.equal(executions, 1);
  executionHealthy = true;
  const accepted = await getRun(env, id, true);
  assert.equal(accepted.state, 'live');
  assert.equal(accepted.stages.length, 4);
  assert.equal(accepted.candidates[0].evidence, 'Old release · Open issue');
  assert.equal(accepted.candidates[0].risks, 'Dependency version · Small maintainer pool');
  assert.equal(accepted.product.repository, 'org/repo');
  assert.equal(accepted.product.priceCents, 500);
  assert.equal(accepted.product.url, `/p/${id}/`);
  assert.equal(executions, 2);
  assert.equal(accepted.product.verifiedExecution.sourceRevision, 'a'.repeat(40));
  assert.equal((await getRun(env, id, true)).state, 'live');
  assert.equal(executions, 2, 'A health refresh must not repeat a verified product execution');
});

test('sandbox proxy refuses origin escape before disclosing preview token', async t => {
  t.mock.method(globalThis, 'fetch', () => { throw Error('Must not contact attacker'); });
  const response = await proxyProduct(new Request(`https://afterlife.test/p/${id}//attacker.test`), { DB: database(live()) });
  assert.equal(response.status, 400);
});

test('sandbox proxy strips user cookies and authorization, isolates generated HTML', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url.origin, 'https://preview.brainbaselabs.space');
    assert.equal(options.headers.cookie, undefined);
    assert.equal(options.headers.authorization, undefined);
    assert.equal(options.headers['x-preview-token'], 'private-preview-test-token');
    return new Response('<html>Product</html>', { headers: { 'content-type': 'text/html', 'set-cookie': 'evil=1' } });
  });
  const response = await proxyProduct(new Request(`https://afterlife.test/p/${id}/`, { headers: { cookie: 'sensitive=1', authorization: 'Bearer private' } }), { DB: database(live()) });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('set-cookie'), null);
  assert.match(response.headers.get('content-security-policy'), /sandbox allow-scripts/);
  assert.doesNotMatch(response.headers.get('content-security-policy'), /allow-same-origin/);
  assert.match(response.headers.get('content-security-policy'), /script-src 'unsafe-inline' https:\/\/afterlife.test/);
});

test('opaque product API accepts CORS preflight and limits payloads', async t => {
  t.mock.method(globalThis, 'fetch', () => { throw Error('Must not fetch'); });
  const env = { DB: database(live()) };
  const preflight = await proxyProduct(new Request(`https://afterlife.test/p/${id}/api/run`, { method: 'OPTIONS' }), env);
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), '*');
  const response = await proxyProduct(new Request(`https://afterlife.test/p/${id}/api/run`, { method: 'POST', body: 'x'.repeat(65537) }), env);
  assert.equal(response.status, 413);
});

test('Stripe payment verifies product, browser ownership and amount before granting access', async t => {
  const token = 'a'.repeat(64), token_hash = createHash('sha256').update(token).digest('hex');
  const owned = { token_hash, run_id: id, session_id: 'cs_test_abc123', amount: 500, state: 'pending' };
  const DB = database(live(), owned);
  let amount = 501;
  t.mock.method(globalThis, 'fetch', async () => Response.json({ id: owned.session_id, livemode: false, mode: 'payment', payment_status: 'paid', metadata: { run_id: id, token_hash }, amount_total: amount, currency: 'usd' }));
  const request = () => new Request(`https://afterlife.test/api/products/${id}/payment?session_id=cs_test_abc123`, { headers: { cookie: `al_${id}=${token}` } });
  const env = { DB, STRIPE_SECRET_KEY: 'sk_test_synthetic' };
  assert.equal((await handleProductBilling(request(), env, id, 'payment')).status, 403);
  assert.equal(DB.writes.length, 0);
  amount = 500;
  assert.deepEqual(await (await handleProductBilling(request(), env, id, 'payment')).json(), { entitled: true });
  assert.equal(DB.writes.length, 1);
});

test('checkout rejects a cross-origin request before creating a Stripe session', async t => {
  t.mock.method(globalThis, 'fetch', () => { throw Error('Must not contact Stripe'); });
  const response = await handleProductBilling(new Request('https://afterlife.test/api/product/checkout', { method: 'POST', headers: { origin: 'https://attacker.test' } }), { DB: database(live()), STRIPE_SECRET_KEY: 'sk_test_synthetic' }, id, 'checkout');
  assert.equal(response.status, 403);
});

test('agent result unwraps provider envelopes and ignores later approval metadata', () => {
  assert.deepEqual(parseAgentResult([
    { role: 'assistant', content: '{"result":{"decision":"FUND","repository":"org/repo"}}' },
    { role: 'assistant', content: '{"risk_level":"low","outcome":"allow"}' },
  ]), { decision: 'FUND', repository: 'org/repo' });
});

function recoveryDb() {
  let claim = null;
  return { prepare(sql) { return { bind(...args) { return {
    async first() { return claim; },
    async run() {
      if (sql.includes('INSERT OR IGNORE')) {
        if (claim) return { meta: { changes: 0 } };
        claim = { state: 'claimed', created_at: args[2] }; return { meta: { changes: 1 } };
      }
      if (sql.startsWith('DELETE')) claim = null;
      else if (sql.includes("state='requested'")) claim.state = 'requested';
      else if (sql.includes("state='failed'")) claim.state = 'failed';
      return { meta: { changes: 1 } };
    },
  }; } }; } };
}
const funded = { decision: 'FUND', repository: 'arbitrary/project', target_capability: 'the actual chosen capability' };
const terminalTask = { id: 'manager-task', status: 'success' };

test('concurrent refreshes continue a missing funded handoff exactly once', async t => {
  const env = { DB: recoveryDb(), BRAINBASE_TOKEN: 'synthetic' }; let starts = 0;
  t.mock.method(globalThis, 'fetch', async (input, init) => {
    if (init.method === 'POST') {
      starts++;
      const body = JSON.parse(init.body);
      assert.equal(body.run, true);
      assert.match(body.messages[0].content, /existing FUND decision/);
      assert.doesNotMatch(body.messages[0].content, /fpocket|DNA/);
      return Response.json({ run_started: true });
    }
    return Response.json(String(input).includes('parent_task_id') ? { items: [] } : terminalTask);
  });
  await Promise.all(Array.from({ length: 4 }, () => recoverHandoff(env, { id }, terminalTask, 'investment', funded)));
  await recoverHandoff(env, { id }, terminalTask, 'investment', funded);
  assert.equal(starts, 1);
});

test('handoff recovery never overrides PASS_ALL, active tasks or a newly queued user continuation', async t => {
  t.mock.method(globalThis, 'fetch', () => { throw Error('No request expected'); });
  const env = { DB: recoveryDb(), BRAINBASE_TOKEN: 'synthetic' };
  assert.equal(await recoverHandoff(env, { id }, terminalTask, 'investment', { decision: 'PASS_ALL' }), null);
  assert.equal(await recoverHandoff(env, { id }, { ...terminalTask, status: 'running' }, 'investment', funded), null);
  assert.equal(await recoverHandoff(env, { id }, terminalTask, 'investment', funded, [
    { role: 'assistant', content: JSON.stringify(funded) }, { role: 'user', content: 'Already continuing' },
  ]), null);
});

test('handoff recovery rechecks children after claiming and never duplicates a native task', async t => {
  let starts = 0;
  t.mock.method(globalThis, 'fetch', async (input, init) => {
    if (init.method === 'POST') starts++;
    return Response.json(String(input).includes('parent_task_id') ? { items: [{ agent_id: agents.resurrection }] } : terminalTask);
  });
  const recovery = await recoverHandoff({ DB: recoveryDb(), BRAINBASE_TOKEN: 'synthetic' }, { id }, terminalTask, 'investment', funded);
  assert.equal(recovery, null);
  assert.equal(starts, 0);
});

test('ambiguous handoff transport failure is recorded and not retried into duplicate tasks', async t => {
  const env = { DB: recoveryDb(), BRAINBASE_TOKEN: 'synthetic' }; let starts = 0;
  t.mock.method(globalThis, 'fetch', async (input, init) => {
    if (init.method === 'POST') { starts++; throw Error('Connection lost after possible acceptance'); }
    return Response.json(String(input).includes('parent_task_id') ? { items: [] } : terminalTask);
  });
  assert.equal((await recoverHandoff(env, { id }, terminalTask, 'investment', funded)).state, 'failed');
  await recoverHandoff(env, { id }, terminalTask, 'investment', funded);
  assert.equal(starts, 1);
});

test('a short arbitrary sector starts a real Scout task without predefined candidates', async t => {
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.match(String(url), /\/v2\/tasks$/);
    const body = JSON.parse(init.body);
    assert.equal(body.agent_id, agents.scout);
    assert.equal(body.auto_run, true);
    assert.match(body.initial_messages[0].content, /opportunity: AI\n/);
    assert.doesNotMatch(body.initial_messages[0].content, /fpocket|DNA|DnaFeaturesViewer/);
    return Response.json({ id: 'new-scout-task' });
  });
  const response = await handleRuns(new Request('https://afterlife.test/api/runs', { method: 'POST', headers: { origin: 'https://afterlife.test' }, body: JSON.stringify({ thesis: 'AI' }) }), { DB: database(null), BRAINBASE_TOKEN: 'synthetic' });
  assert.equal(response.status, 201);
  assert.equal((await response.json()).state, 'running');
});

test('agent timestamps consistently treat timezone-less API timestamps as UTC', () => {
  const expected = '2026-09-28T21:23:45.123Z';
  assert.equal(normalizeAgentTime('2026-09-28T21:23:45.123456'), expected);
  assert.equal(normalizeAgentTime('2026-09-28T21:23:45.123456Z'), expected);
  assert.equal(normalizeAgentTime('2026-09-28T14:23:45.123-07:00'), expected);
  assert.equal(normalizeAgentTime(undefined), null);
});

test('activity feed excludes machine control JSON, including serialized strings and fences', () => {
  const control = JSON.stringify({ risk_level: 'low', user_authorization: 'high', outcome: 'allow' });
  for (const content of [control, JSON.stringify(control), `\`\`\`json\n${control}\n\`\`\``, `Approval result: ${control}`, '{"status":"READY"}']) assert.equal(isAgentNarration(content), false);
  assert.equal(isAgentNarration('I verified two real inputs and am preparing the product.'), true);
});

test('a verified developer handoff blocked by orchestration403 gets one compact native retry', async t => {
  const env = { DB: recoveryDb(), BRAINBASE_TOKEN: 'synthetic' }; let starts = 0;
  t.mock.method(globalThis, 'fetch', async (input, init) => {
    if (init.method === 'POST') {
      starts++;
      const content = JSON.parse(init.body).messages[0].content;
      assert.match(content, /compact plain-text reproduction under 8000/);
      assert.match(content, /omit embedded HTML/);
      return Response.json({ run_started: true });
    }
    return Response.json(String(input).includes('parent_task_id') ? { items: [] } : terminalTask);
  });
  const result = { status: 'FAILED', error: 'Two direct CSVMeta write/read checks succeeded, but the required single Product Engineer handoff returned HTTP 403 from the orchestration service.' };
  assert.equal((await recoverHandoff(env, { id }, terminalTask, 'resurrection', result)).state, 'requested');
  await recoverHandoff(env, { id }, terminalTask, 'resurrection', result);
  assert.equal(starts, 1);
  assert.equal(await recoverHandoff(env, { id }, terminalTask, 'resurrection', { status: 'FAILED', error: 'Build failed and handoff returned HTTP 403 from orchestration.' }), null);
});

test('failed snapshots refresh after30seconds and ignore stale FAILED output during active continuation', async t => {
  const row = { id, thesis: 'A sector', state: 'failed', root_task_id: 'task0', created_at: 0, updated_at: Math.floor(Date.now() / 1000) - 31, snapshot: JSON.stringify({ id, state: 'failed', error: 'Old error' }) };
  const tasks = ['scout', 'investment', 'resurrection'].map((kind, index) => ({ id: `task${index}`, agent_id: agents[kind], status: index === 2 ? 'running' : 'success', created_at: '2026-09-28T21:00:00Z' }));
  const results = [{ candidates: [{ repository: 'org/repo' }] }, { decision: 'FUND', repository: 'org/repo' }, { status: 'FAILED', error: 'Prior handoff failed' }];
  t.mock.method(globalThis, 'fetch', async (input, init) => {
    assert.notEqual(init.method, 'POST', 'Do not duplicate an already running continuation');
    const url = new URL(input);
    if (url.searchParams.has('parent_task_id')) {
      const index = Number(url.searchParams.get('parent_task_id').slice(-1));
      return Response.json({ items: tasks.slice(index + 1, index + 2) });
    }
    const index = Number(url.pathname.match(/task(\d)/)?.[1]);
    return Response.json(url.pathname.endsWith('/messages') ? { items: [{ role: 'assistant', content: JSON.stringify(results[index]) }] } : tasks[index]);
  });
  const refreshed = await getRun({ DB: database(row), BRAINBASE_TOKEN: 'synthetic' }, id);
  assert.equal(refreshed.state, 'running');
  assert.equal(refreshed.error, null);
  assert.equal(refreshed.stages.at(-1).status, 'running');
  assert.equal(refreshed.stages.at(-1).resultStatus, undefined);
});

const bootstrapTask = { id: 'product-task', agent_id: agents.product, status: 'fail', status_info: { phase: 'initialize', sandbox_initialized: false, terminal_at: '2026-09-28T21:30:00Z', error: 'BootstrapStepError: ThrottlerException: Too Many Requests' } };
test('temporary bootstrap provider limits retry the same native task once under concurrency', async t => {
  const canonicalInstructions = 'Serve the real recovered software on 0.0.0.0:8080 with /health, /afterlife.json and /api/run.';
  const originalInput = '{"repositoryUrl":"https://github.com/arbitrary/recovered-project","reproduction":"Original verified setup commands\\nOriginal real input/output"}';
  const env = { DB: recoveryDb(), BRAINBASE_TOKEN: 'synthetic' }; let starts = 0;
  t.mock.method(globalThis, 'fetch', async (input, init) => {
    if (String(input).includes('/agents/')) return Response.json({ instructions: canonicalInstructions, secrets: { private: 'never-forward-this-secret' } });
    if (init.method === 'POST') {
      starts++;
      assert.match(String(input), /tasks\/product-task\/messages$/);
      assert.match(JSON.parse(init.body).messages[0].content, /single automatic retry/);
      assert.ok(JSON.parse(init.body).messages[0].content.includes(canonicalInstructions));
      assert.doesNotMatch(init.body, /never-forward-this-secret/);
      assert.ok(JSON.parse(init.body).messages[0].content.endsWith(originalInput), 'The new runtime must receive the complete original payload verbatim');
      return Response.json({ run_started: true });
    }
    return Response.json(String(input).includes('/messages?') ? { items: [{ role: 'user', content: originalInput }, { role: 'assistant', content: 'Task initializing' }] } : bootstrapTask);
  });
  await Promise.all(Array.from({ length: 4 }, () => recoverBootstrap(env, { id }, bootstrapTask)));
  await recoverBootstrap(env, { id }, bootstrapTask);
  assert.equal(starts, 1);
});

test('bootstrap retry excludes actual execution failures, active tasks and queued manual retries', async t => {
  t.mock.method(globalThis, 'fetch', () => { throw Error('Must not retry'); });
  const env = { DB: recoveryDb(), BRAINBASE_TOKEN: 'synthetic' };
  assert.equal(await recoverBootstrap(env, { id }, { ...bootstrapTask, status: 'running' }), null);
  assert.equal(await recoverBootstrap(env, { id }, { ...bootstrapTask, status_info: { ...bootstrapTask.status_info, sandbox_initialized: true } }), null);
  assert.equal(await recoverBootstrap(env, { id }, { ...bootstrapTask, status_info: { ...bootstrapTask.status_info, error: 'Actual code syntax failure' } }), null);
  assert.equal(await recoverBootstrap(env, { id }, bootstrapTask, [{ role: 'user', created_at: '2026-09-28T21:31:00Z', content: 'Manual retry already queued' }]), null);
});

test('bootstrap retry rechecks the latest status before resuming a task', async t => {
  t.mock.method(globalThis, 'fetch', async (input, init) => {
    assert.notEqual(init.method, 'POST');
    return Response.json(String(input).includes('/messages?') ? { items: [] } : { ...bootstrapTask, status: 'running' });
  });
  assert.equal(await recoverBootstrap({ DB: recoveryDb(), BRAINBASE_TOKEN: 'synthetic' }, { id }, bootstrapTask), null);
});

test('long Brainbase histories expand the documented prefix and preserve first input plus latest result', async t => {
  const messages = Array.from({ length: 501 }, (_, index) => ({ id: `message${index}`, role: 'tool', content: 'Tool progress' }));
  messages[0] = { id: 'initial', role: 'user', content: 'Original repository and complete reproduction' };
  messages[500] = { id: 'final', role: 'assistant', content: '{"status":"READY","repository":"org/repo"}' };
  const limits = [];
  t.mock.method(globalThis, 'fetch', async input => {
    const url = new URL(input), limit = Number(url.searchParams.get('limit'));
    assert.equal(url.pathname, '/v2/tasks/task-with-long-history/messages');
    assert.equal(url.searchParams.has('cursor'), false);
    assert.equal(url.searchParams.has('offset'), false);
    limits.push(limit);
    return Response.json({ items: messages.slice(0, limit) });
  });
  const history = await taskMessages({ BRAINBASE_TOKEN: 'synthetic' }, 'task-with-long-history');
  assert.deepEqual(limits, [200, 400, 800]);
  assert.equal(history.items[0].content, messages[0].content);
  assert.equal(history.items.at(-1).id, 'final');
  assert.equal(parseAgentResult(history.items).status, 'READY');
});

test('an exact200message history checks for a later result without dropping or duplicating messages', async t => {
  const messages = Array.from({ length: 200 }, (_, index) => ({ id: `message${index}` }));
  const limits = [];
  t.mock.method(globalThis, 'fetch', async input => {
    limits.push(Number(new URL(input).searchParams.get('limit')));
    return Response.json({ items: messages });
  });
  assert.equal((await taskMessages({ BRAINBASE_TOKEN: 'synthetic' }, 'exact-boundary')).items.length, 200);
  assert.deepEqual(limits, [200, 400]);
});

test('a failed initial task creation stays failed when reloaded instead of showing starting forever', async t => {
  t.mock.method(globalThis, 'fetch', () => { throw Error('There is no native task to query'); });
  const row = { id, thesis: 'A new sector', state: 'failed', root_task_id: null, snapshot: null, created_at: 1, updated_at: 1 };
  const result = await getRun({ DB: database(row) }, id);
  assert.equal(result.state, 'failed');
  assert.match(result.error, /could not be started.*Start a new run/);
  assert.deepEqual(result.stages, []);
});
