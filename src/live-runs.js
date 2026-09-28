import agents from '../agents/live-config.json' with { type: 'json' };
import { readJson } from './request-body.js';

const json = (data, status = 200) => Response.json(data, { status, headers: { 'cache-control': 'no-store' } });
const now = () => Math.floor(Date.now() / 1000);
const labels = { scout: 'Scout', investment: 'Investment manager', resurrection: 'Resurrection engineer', product: 'Product engineer' };
export async function brainbase(env, path, body) {
  const response = await fetch(`https://api.brainbaselabs.com/v2/${path}`, {
    method: body ? 'POST' : 'GET', headers: { authorization: `Bearer ${env.BRAINBASE_TOKEN}`, 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`Brainbase returned ${response.status}`);
  return response.json();
}
export async function taskMessages(env, taskId) {
  // Brainbase's live OpenAPI exposes a prefix limit (default 200), not a cursor
  // or offset. Grow that documented prefix until it contains the entire history.
  // Preserve the first native input for retries and the newest result together.
  for (let limit = 200; limit <= 12800; limit *= 2) {
    const list = await brainbase(env, `tasks/${taskId}/messages?limit=${limit}`);
    if (!Array.isArray(list.items)) throw Error('Brainbase returned an invalid message history');
    if (list.items.length < limit) return list;
  }
  throw Error('Agent history exceeds the supported message window; incomplete results were not used');
}
function unwrapResult(result) {
  for (let depth = 0; depth < 4 && result && typeof result === 'object' && !Array.isArray(result); depth++) {
    if (Array.isArray(result.candidates) || typeof result.decision === 'string' || typeof result.status === 'string') return result;
    let nested = result.result ?? result.payload ?? result.output;
    if (typeof nested === 'string') { try { nested = JSON.parse(nested); } catch { return null; } }
    if (!nested || typeof nested !== 'object' || Array.isArray(nested)) return null;
    result = nested;
  }
  return null;
}
export function parseAgentResult(messages) {
  for (const message of [...messages].reverse()) {
    if (message.role !== 'assistant' || typeof message.content !== 'string') continue;
    const text = message.content.trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    try { const result = unwrapResult(JSON.parse(text)); if (result) return result; } catch {}
    const first = text.indexOf('{'), last = text.lastIndexOf('}');
    if (first >= 0 && last > first) { try { const result = unwrapResult(JSON.parse(text.slice(first, last + 1))); if (result) return result; } catch {} }
  }
  return null;
}
function handoff(messages) {
  for (const message of [...messages].reverse()) for (const call of message.tool_calls || []) {
    try {
      const args = typeof call.function?.arguments === 'string' ? JSON.parse(call.function.arguments) : call.function?.arguments;
      if (Array.isArray(args?.payload?.candidates)) return args.payload;
      if (Array.isArray(args?.candidates)) return args;
    } catch {}
  }
  return null;
}
function safeText(value, limit = 1500) {
  if (Array.isArray(value)) return value.map(item => safeText(item, limit)).filter(Boolean).join(' · ').slice(0, limit);
  return typeof value === 'string' ? value.slice(0, limit) : value == null ? '' : JSON.stringify(value).slice(0, limit);
}
export function normalizeAgentTime(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const text = value.trim();
  const utc = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(text) ? text : `${text}Z`;
  const timestamp = Date.parse(utc);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}
export function isAgentNarration(content) {
  if (typeof content !== 'string' || !content.trim()) return false;
  const text = content.trim();
  // Structured final results and runtime approval/control records belong in
  // typed reports, never in the human activity feed (including JSON strings).
  if (text.startsWith('```')) return false;
  try { JSON.parse(text); return false; } catch {}
  const first = text.indexOf('{'), last = text.lastIndexOf('}');
  if (first >= 0 && last > first) { try { JSON.parse(text.slice(first, last + 1)); return false; } catch {} }
  return true;
}
export function validPreview(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || !['.brainbaselabs.space', '.proxy.daytona.works', '.daytona.work'].some(s => parsed.hostname.endsWith(s))) throw Error('Unrecognized sandbox preview host');
  return parsed;
}
function verifiedHandoffTransportFailure(result) {
  const error = typeof result?.error === 'string' ? result.error : '';
  const verifiedInputs = Number(result?.verification?.inputs) >= 2 || /(?:two|2)\b.*(?:checks|inputs|executions)\b.*(?:succeeded|passed|verified)/i.test(error);
  return result?.status === 'FAILED' && verifiedInputs && /handoff/i.test(error) && /HTTP\s*403/i.test(error) && /orchestration/i.test(error);
}
function eligibleHandoff(kind, result) {
  return (kind === 'scout' && Array.isArray(result?.candidates) && result.candidates.length > 0)
    || (kind === 'investment' && result?.decision === 'FUND' && typeof result.repository === 'string' && result.repository.length > 0)
    || (kind === 'resurrection' && verifiedHandoffTransportFailure(result))
    || (kind === 'resurrection' && result?.status === 'READY' && typeof result.repository === 'string' && typeof result.sourceRevision === 'string');
}
export async function recoverHandoff(env, row, task, kind, result, messages = []) {
  if (task.status !== 'success' || !eligibleHandoff(kind, result)) return null;
  // A recently queued user continuation may not yet have updated task.status.
  const lastUser = messages.findLastIndex(message => message.role === 'user');
  const lastResult = messages.findLastIndex(message => message.role === 'assistant' && parseAgentResult([message]));
  if (lastUser > lastResult) return null;
  const timestamp = now();
  const claim = await env.DB.prepare(`INSERT OR IGNORE INTO afterlife_handoff_recovery(task_id,run_id,state,created_at,updated_at)
    VALUES(?1,?2,'claimed',?3,?3)`).bind(task.id, row.id, timestamp).run();
  if (!claim.meta.changes) return env.DB.prepare('SELECT state,created_at,error FROM afterlife_handoff_recovery WHERE task_id=?1').bind(task.id).first();
  try {
    // Recheck after the durable claim: another agent or manual continuation may
    // have started while the original task/messages/children reads were in flight.
    const [current, children] = await Promise.all([
      brainbase(env, `tasks/${task.id}`), brainbase(env, `tasks?parent_task_id=${task.id}&limit=20`),
    ]);
    const nextKind = { scout: 'investment', investment: 'resurrection', resurrection: 'product' }[kind];
    if (current.status !== 'success' || (children.items || []).some(child => child.agent_id === agents[nextKind])) {
      await env.DB.prepare('DELETE FROM afterlife_handoff_recovery WHERE task_id=?1').bind(task.id).run();
      return null;
    }
    const instruction = {
      scout: 'Send your existing complete candidates evidence to the Investment Committee using the native create_task_for_* tool. Preserve every existing candidate and required schema field.',
      investment: 'Send your existing FUND decision to Resurrection Engineer using the native create_task_for_* tool. Use repositoryUrl https://github.com/<repository> and targetCapability from your existing decision. Preserve the selected repository and budget.',
      resurrection: 'Send your verified recovery to Product Engineer using the native create_task_for_* tool with repositoryUrl, sourceRevision, productName, capability, and a self-contained reproduction string containing exact patches/setup plus the two actual input/output examples.',
    }[kind];
    const transportGuidance = verifiedHandoffTransportFailure(result) ? ' Your prior two capability checks succeeded but the native transport blocked the handoff. Verify that existing execution evidence, then retry the handoff once using a compact plain-text reproduction under 8000 characters. Include the precise setup/patch and the two real input/output examples; omit embedded HTML, long transcripts and UI source. The Product Engineer builds its own UI. If this retry fails, report the error honestly.' : '';
    const response = await brainbase(env, `tasks/${task.id}/messages`, { messages: [{ role: 'user', content: `Your completed result is recorded, but the required next native task does not exist. Continue only the missing handoff. ${instruction}${transportGuidance} Discover your available native orchestration tools and invoke the correct outgoing tool exactly once. Do not choose a new repository, redo the analysis, or fabricate a downstream result. Wait for the tool acknowledgement, then restate your existing final JSON result and finish. Do not wait for downstream completion.` }], run: true });
    if (response.run_started === false) throw Error('Brainbase did not start the continuation');
    await env.DB.prepare("UPDATE afterlife_handoff_recovery SET state='requested',updated_at=?1 WHERE task_id=?2").bind(now(), task.id).run();
    return { state: 'requested', created_at: timestamp };
  } catch (error) {
    // An ambiguous transport failure must never create a duplicate downstream task.
    await env.DB.prepare("UPDATE afterlife_handoff_recovery SET state='failed',error=?1,updated_at=?2 WHERE task_id=?3").bind(safeText(error.message, 200), now(), task.id).run();
    return { state: 'failed', created_at: timestamp, error: 'Automatic native handoff continuation could not be confirmed.' };
  }
}
function transientBootstrapLimit(task) {
  return task.status === 'fail' && task.status_info?.phase === 'initialize'
    && task.status_info.sandbox_initialized === false
    && /ThrottlerException|\b429\b|too many requests/i.test(task.status_info.error || '');
}
function pendingBootstrapContinuation(task, messages) {
  const failedAt = Date.parse(normalizeAgentTime(task.status_info?.terminal_at));
  return Number.isFinite(failedAt) && messages.some(message => message.role === 'user'
    && Date.parse(normalizeAgentTime(message.created_at)) > failedAt);
}
export async function recoverBootstrap(env, row, task, messages = []) {
  if (!transientBootstrapLimit(task) || pendingBootstrapContinuation(task, messages)) return null;
  const key = `${task.id}:bootstrap`, timestamp = now();
  const claim = await env.DB.prepare(`INSERT OR IGNORE INTO afterlife_handoff_recovery(task_id,run_id,state,created_at,updated_at)
    VALUES(?1,?2,'claimed',?3,?3)`).bind(key, row.id, timestamp).run();
  if (!claim.meta.changes) return env.DB.prepare('SELECT state,created_at,error FROM afterlife_handoff_recovery WHERE task_id=?1').bind(key).first();
  try {
    const [current, list] = await Promise.all([
      brainbase(env, `tasks/${task.id}`), taskMessages(env, task.id),
    ]);
    if (!transientBootstrapLimit(current) || pendingBootstrapContinuation(current, list.items || [])) {
      await env.DB.prepare('DELETE FROM afterlife_handoff_recovery WHERE task_id=?1').bind(key).run();
      return null;
    }
    // A fresh Brainbase runtime receives only this continuation message. Replay
    // the initial native task input, not a later generic retry/steering message.
    const originalInput = (list.items || []).find(message => message.role === 'user' && typeof message.content === 'string' && message.content.trim())?.content;
    if (!originalInput) throw Error('Original task input is unavailable for initialization retry');
    if (!current.agent_id) throw Error('Agent identity is unavailable for initialization retry');
    // Failed provider linking can also omit the agent's system prompt. Recover
    // only the canonical instructions field; never forward secrets or metadata.
    const agent = await brainbase(env, `agents/${current.agent_id}`);
    const instructions = agent.instructions;
    if (typeof instructions !== 'string' || !instructions.trim()) throw Error('Agent instructions are unavailable for initialization retry');
    const response = await brainbase(env, `tasks/${task.id}/messages`, { messages: [{ role: 'user', content: 'Resume your original assigned task after the temporary provider credential-verification rate limit during initialization. The sandbox did not start. Follow the canonical agent instructions and original task input below; preserve the selected repository and native workflow. This is the single automatic retry for this initialization failure.\n\nCanonical agent instructions (verbatim):\n\n' + instructions + '\n\nOriginal task input (verbatim):\n\n' + originalInput }], run: true });
    if (response.run_started === false) throw Error('Brainbase did not start the initialization retry');
    await env.DB.prepare("UPDATE afterlife_handoff_recovery SET state='requested',updated_at=?1 WHERE task_id=?2").bind(now(), key).run();
    return { state: 'requested', created_at: timestamp };
  } catch (error) {
    await env.DB.prepare("UPDATE afterlife_handoff_recovery SET state='failed',error=?1,updated_at=?2 WHERE task_id=?3").bind(safeText(error.message, 200), now(), key).run();
    return { state: 'failed', created_at: timestamp };
  }
}
async function refresh(env, row) {
  const stages = [], events = [];
  let taskId = row.root_task_id, candidates = [], decision = null, repair = null, product = null, productTask = null;
  for (let depth = 0; depth < 4 && taskId; depth++) {
    const [task, list, children] = await Promise.all([
      brainbase(env, `tasks/${taskId}`), taskMessages(env, taskId), brainbase(env, `tasks?parent_task_id=${taskId}&limit=20`),
    ]);
    const kind = Object.keys(labels).find(key => agents[key] === task.agent_id);
    if (!kind) break;
    const messages = Array.isArray(list.items) ? list.items : [], result = parseAgentResult(messages);
    stages.push({ kind, label: labels[kind], taskId: task.id, status: task.status, startedAt: normalizeAgentTime(task.created_at), resultStatus: task.status === 'success' ? result?.status : undefined });
    events.push({ stage: kind, id: task.id, time: normalizeAgentTime(task.created_at), text: `${labels[kind]} · ${task.status}`, status: task.status });
    for (const msg of messages.filter(m => m.role === 'assistant' && typeof m.content === 'string' && m.content.trim()).slice(-5)) {
      // Only agent narration; never publish tool commands, tool responses, or internal secrets.
      if (!isAgentNarration(msg.content)) continue;
      events.push({ stage: kind, id: msg.id, time: normalizeAgentTime(msg.created_at), text: safeText(msg.content, 700), status: 'message' });
    }
    const candidateResult = result?.candidates || handoff(messages)?.candidates;
    if (kind === 'scout') candidates = (Array.isArray(candidateResult) ? candidateResult : []).filter(c => c && typeof c === 'object').slice(0, 10).map(c => ({
      repository: safeText(c.repository, 160), capability: safeText(c.capability), license: safeText(c.license, 120),
      evidence: safeText(c.neglect_evidence), recommendation: safeText(c.recommendation), productHypothesis: safeText(c.product_hypothesis),
      risks: safeText(c.technical_risks), activity: safeText(c.last_meaningful_activity, 200),
    }));
    if (kind === 'investment' && result) decision = { decision: safeText(result.decision, 40), repository: safeText(result.repository, 160), reason: safeText(result.reason), productHypothesis: safeText(result.product_hypothesis) };
    if (kind === 'resurrection' && result) repair = { status: result.status, summary: safeText(result.repairSummary || result.error), repository: safeText(result.repository, 160), revision: safeText(result.sourceRevision, 64), capability: safeText(result.capability), verification: result.verification };
    if (kind === 'product') { product = result; productTask = task; }
    const nextKind = ['scout', 'investment', 'resurrection', 'product'][depth + 1];
    const next = (children.items || []).filter(t => t.agent_id === agents[nextKind]).sort((a,b) => String(a.created_at).localeCompare(String(b.created_at)))[0];
    if (!next && nextKind) {
      const recovery = await recoverHandoff(env, row, task, kind, result || handoff(messages), messages);
      if (recovery) {
        stages.at(-1).handoffRecovery = recovery.state;
        if (recovery.state === 'requested' || recovery.state === 'claimed') {
          events.push({ stage: kind, id: `handoff-${task.id}`, time: new Date(recovery.created_at * 1000).toISOString(), text: `${labels[kind]} · continuing the missing native handoff`, status: 'message' });
          if (now() - recovery.created_at < 600) { stages.at(-1).status = 'running'; stages.at(-1).resultStatus = undefined; }
        }
      }
    }
    if (!next && task.status === 'fail') {
      const recovery = await recoverBootstrap(env, row, task, messages);
      if (recovery && ['claimed', 'requested'].includes(recovery.state)) {
        events.push({ stage: kind, id: `bootstrap-${task.id}`, time: new Date(recovery.created_at * 1000).toISOString(), text: `${labels[kind]} · Retrying temporary provider limit`, status: 'message' });
        if (now() - recovery.created_at < 600) { stages.at(-1).status = 'running'; stages.at(-1).resultStatus = undefined; }
      }
    }
    taskId = next?.id;
  }
  let state = 'running';
  let error = null, liveProduct = null;
  if (stages.some(s => ['fail', 'need_more_info', 'idle', 'cancelled'].includes(s.status) || (s.status === 'success' && s.resultStatus === 'FAILED'))) {
    state = 'failed'; error = safeText(product?.error || (repair?.status === 'FAILED' ? repair.summary : null)) || 'An agent stopped before completing its stage. Inspect the activity and task report.';
  }
  if (decision?.decision === 'PASS_ALL') state = 'passed';
  if (product?.status === 'READY' && productTask?.status === 'success') {
    try {
      const preview = await brainbase(env, `machines/${productTask.machine_id}/preview?port=8080`);
      const base = validPreview(preview.url);
      const headers = preview.token ? { [preview.token_header || 'x-preview-token']: preview.token } : {};
      const [healthResponse, manifestResponse] = await Promise.all([
        fetch(new URL('/health', base), { headers, redirect: 'manual', signal: AbortSignal.timeout(12000) }),
        fetch(new URL('/afterlife.json', base), { headers, redirect: 'manual', signal: AbortSignal.timeout(12000) }),
      ]);
      if (!healthResponse.ok || !manifestResponse.ok) throw Error('Preview is not responding');
      const health = await healthResponse.json(), manifest = await manifestResponse.json();
      // Preview providers may reserve /health and return ok before the app starts.
      // Source identity and the actual example execution below decide readiness.
      if (!['ok', 'ready'].includes(health.status) || typeof manifest.name !== 'string' || !manifest.name.trim() || typeof manifest.repository !== 'string') throw Error('Product health contract is incomplete');
      const selectedRepository = decision?.repository || repair?.repository;
      if (!selectedRepository || manifest.repository.toLowerCase() !== selectedRepository.toLowerCase() || (repair?.repository && manifest.repository.toLowerCase() !== repair.repository.toLowerCase())) throw Error('Product repository does not match the funded recovery');
      if (!repair?.revision || manifest.sourceRevision !== repair.revision) throw Error('Product revision does not match the verified recovery');
      if (!Object.hasOwn(manifest, 'exampleInput')) throw Error('Product manifest has no example input');
      const previous = row.snapshot ? JSON.parse(row.snapshot).product : null;
      const previousExecution = previous?.verifiedExecution;
      let verifiedExecution = row.preview_url === base.origin && previous?.revision === manifest.sourceRevision && previousExecution?.sourceRevision === manifest.sourceRevision ? previousExecution : null;
      if (!verifiedExecution) {
        const executionResponse = await fetch(new URL('/api/run', base), {
          method: 'POST', headers: { ...headers, 'content-type': 'application/json' },
          body: JSON.stringify({ input: manifest.exampleInput }), redirect: 'manual', signal: AbortSignal.timeout(25000),
        });
        if (!executionResponse.ok) throw Error('Product example execution failed');
        const execution = await executionResponse.json();
        if (execution?.success !== true || !Object.hasOwn(execution, 'result')) throw Error('Product example returned no successful result');
        verifiedExecution = { sourceRevision: manifest.sourceRevision, verifiedAt: now() };
      }
      liveProduct = { verifiedExecution, name: safeText(manifest.name, 100), description: safeText(manifest.description), repository: safeText(manifest.repository, 160), revision: safeText(manifest.sourceRevision, 64), capability: safeText(manifest.capability), url: `/p/${row.id}/`, priceCents: Math.round(Math.max(100, Math.min(5000, Number(manifest.priceCents) || 500))), limitations: Array.isArray(product.limitations) ? product.limitations.map(v => safeText(v, 300)).slice(0, 10) : [], temporary: true };
      state = 'live';
      await env.DB.prepare('UPDATE afterlife_runs SET preview_url=?1, preview_token=?2, preview_header=?3 WHERE id=?4').bind(base.origin, preview.token || null, preview.token_header || null, row.id).run();
    } catch { error = 'The product agent finished, but its temporary preview has not passed the live health check and example execution. Retrying automatically.'; }
  }
  if (!taskId && !productTask && stages.length && stages.every(s => s.status === 'success') && state === 'running') {
    // Native edge creation can lag behind the parent completion briefly.
    const elapsed = now() - (Date.parse(stages.at(-1).startedAt) / 1000);
    if (elapsed > 1200) { state = 'failed'; error = 'The native handoff did not start the next agent.'; }
  }
  const snapshot = { id: row.id, thesis: row.thesis, createdAt: row.created_at, updatedAt: now(), state, stages, candidates, decision, repair, product: liveProduct, events: events.sort((a,b) => String(b.time).localeCompare(String(a.time))), error, billing: { configured: ['sk_test_', 'rk_test_', 'rkcs_test_'].some(prefix => env.STRIPE_SECRET_KEY?.startsWith(prefix)), mode: 'test' } };
  await env.DB.prepare('UPDATE afterlife_runs SET state=?1,snapshot=?2,updated_at=?3 WHERE id=?4').bind(state, JSON.stringify(snapshot), now(), row.id).run();
  return snapshot;
}
export async function getRun(env, id, force = false) {
  const row = await env.DB.prepare('SELECT * FROM afterlife_runs WHERE id=?1').bind(id).first();
  if (!row) return null;
  const cached = row.snapshot ? JSON.parse(row.snapshot) : null;
  if (cached && !force && (now() - row.updated_at < 12 || row.state === 'passed' || (row.state === 'failed' && now() - row.updated_at < 30) || (row.state === 'live' && now() - row.updated_at < 60))) return cached;
  if (!row.root_task_id) return { id, state: row.state === 'failed' ? 'failed' : 'starting', thesis: row.thesis, stages: [], candidates: [], events: [], createdAt: row.created_at, error: row.state === 'failed' ? 'The agent run could not be started. Start a new run to try again.' : null };
  try { return await refresh(env, row); } catch (error) { if (cached) return { ...cached, refreshError: error.message }; throw error; }
}
export async function handleRuns(request, env) {
  if (!env.DB || !env.BRAINBASE_TOKEN) return json({ error: 'Live orchestration is not configured' }, 503);
  const url = new URL(request.url), id = url.pathname.split('/')[3];
  try {
    if (request.method === 'GET') {
      if (id) { const run = await getRun(env, id); return run ? json(run) : json({ error: 'Run not found' }, 404); }
      const rows = await env.DB.prepare('SELECT id,thesis,state,created_at,snapshot FROM afterlife_runs ORDER BY created_at DESC LIMIT 20').all();
      return json({ runs: rows.results.map(r => ({ id: r.id, thesis: r.thesis, state: r.state, createdAt: r.created_at, product: r.snapshot ? JSON.parse(r.snapshot).product : null })) });
    }
    if (request.method !== 'POST' || id) return json({ error: 'Method not allowed' }, 405);
    if (request.headers.get('origin') && request.headers.get('origin') !== url.origin) return json({ error: 'Start a run from the Afterlife console' }, 403);
    const body = await readJson(request), thesis = typeof body?.thesis === 'string' ? body.thesis.trim() : '';
    if (thesis.length < 2 || thesis.length > 1500) return json({ error: 'Enter a sector or opportunity in 2–1500 characters.' }, 400);
    const runId = crypto.randomUUID(), timestamp = now();
    // One concurrent public run, at most 10 daily. Conditional INSERT closes simultaneous request races.
    const created = await env.DB.prepare(`INSERT INTO afterlife_runs(id,thesis,state,created_at,updated_at)
      SELECT ?1,?2,'starting',?3,?3 WHERE NOT EXISTS(SELECT 1 FROM afterlife_runs WHERE state IN ('starting','running') AND created_at>?4)
      AND (SELECT COUNT(*) FROM afterlife_runs WHERE created_at>?5)<10`).bind(runId, thesis, timestamp, timestamp - 3600, timestamp - 86400).run();
    if (!created.meta.changes) return json({ error: 'A run is already active, or today’s demo limit has been reached. Open the latest run to follow its progress.' }, 409);
    try {
      const task = await brainbase(env, 'tasks', { agent_id: agents.scout, title: `Afterlife: ${thesis.slice(0, 70)}`, metadata: { afterlife_run_id: runId, orchestration_id: agents.orchestration }, auto_run: true,
        initial_messages: [{ role: 'user', content: `Find three real open-source repositories for this sector or opportunity: ${thesis}\nNo predetermined winner. Do not prefer old, abandoned, neglected, low-star or inactive repositories: maintained and popular projects are equally eligible. Verify a license that allows commercial use; unknown or noncommercial licenses cannot be funded. Rank sector relevance, user value and implementation feasibility. Record maintenance context without using age as an investment advantage. Prefer a lightweight CPU capability that can become a useful human web tool quickly. The downstream pipeline will repair, verify and package the selected capability. Your role is ONLY discovery and the native handoff to the Investment Committee. Invoke your native handoff tool once with complete evidence, then return the candidates JSON immediately. Do not monitor downstream tasks, build a product, or deploy anything yourself. No paid infrastructure outside this sandbox.` }] });
      await env.DB.prepare("UPDATE afterlife_runs SET root_task_id=?1,state='running' WHERE id=?2").bind(task.id, runId).run();
      return json({ id: runId, state: 'running' }, 201);
    } catch (error) { await env.DB.prepare("UPDATE afterlife_runs SET state='failed' WHERE id=?1").bind(runId).run(); throw error; }
  } catch (error) { return json({ error: error instanceof RangeError ? 'Request too large' : error.message || 'Live service unavailable' }, error instanceof RangeError ? 413 : error instanceof SyntaxError ? 400 : 502); }
}
export async function scheduledRefresh(env) {
  if (!env.DB || !env.BRAINBASE_TOKEN) return;
  const rows = await env.DB.prepare("SELECT id FROM afterlife_runs WHERE state='running' ORDER BY created_at DESC LIMIT 3").all();
  await Promise.allSettled(rows.results.map(row => getRun(env, row.id)));
}
