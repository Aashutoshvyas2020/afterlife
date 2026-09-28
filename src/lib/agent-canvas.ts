import type { LiveRun } from './live-types';

export type AgentCanvasKey = 'scout' | 'investment' | 'resurrection' | 'product';
export type AgentCanvasStatus = 'waiting' | 'working' | 'complete' | 'failed';
export type AgentCanvasMessage = LiveRun['events'][number];
export type AgentCanvasNode = {
  key: AgentCanvasKey;
  title: string;
  status: AgentCanvasStatus;
  summary: string;
  outputTitle: string;
  outputLines: string[];
  messages: AgentCanvasMessage[];
  taskId?: string;
};
export type AgentHandoff = {
  from: AgentCanvasKey;
  to: AgentCanvasKey;
  label: string;
  status: AgentCanvasStatus;
};

const definitions: { key: AgentCanvasKey; title: string; outputTitle: string }[] = [
  { key: 'scout', title: 'Scout', outputTitle: 'Discovered repositories' },
  { key: 'investment', title: 'Investment manager', outputTitle: 'Investment decision' },
  { key: 'resurrection', title: 'Developer', outputTitle: 'Verified recovery' },
  { key: 'product', title: 'Product engineer', outputTitle: 'Hosted product' },
];
const failures = new Set(['fail', 'failed', 'need_more_info', 'idle', 'cancelled']);
const active = new Set(['running', 'initializing', 'queued', 'pending']);

function statusFor(run: LiveRun | null, key: AgentCanvasKey): AgentCanvasStatus {
  const stage = run?.stages.find(item => item.kind === key);
  if (key === 'product' && run?.state === 'live' && run.product) return 'complete';
  if (!stage) return 'waiting';
  if (failures.has(stage.status) || (stage.status === 'success' && stage.resultStatus === 'FAILED')) return 'failed';
  if (active.has(stage.status)) return 'working';
  // A completed agent alone is not proof that its generated application works.
  if (key === 'product') return 'waiting';
  return stage.status === 'success' ? 'complete' : 'waiting';
}

export function buildAgentCanvas(run: LiveRun | null): AgentCanvasNode[] {
  return definitions.map(definition => {
    const { key } = definition;
    const stage = run?.stages.find(item => item.kind === key);
    const status = statusFor(run, key);
    const messages = (run?.events || []).filter(event => event.stage === key || (!event.stage && event.id === stage?.taskId));
    let summary = 'Waiting for this stage.';
    let outputLines: string[] = [];
    if (key === 'scout') {
      const candidates = run?.candidates || [];
      outputLines = candidates.map(candidate => [candidate.repository, candidate.capability, candidate.license ? `License: ${candidate.license}` : ''].filter(Boolean).join(' · '));
      summary = candidates.length ? `${candidates.length} repositories discovered.` : status === 'working' ? 'Searching repositories for your sector.' : status === 'complete' ? 'Discovery finished; no candidate report is available.' : 'Waiting to discover repositories.';
    } else if (key === 'investment') {
      const decision = run?.decision;
      outputLines = decision ? [decision.decision === 'PASS_ALL' ? 'No investment made' : decision.repository, decision.reason, decision.productHypothesis].filter(Boolean) : [];
      summary = decision?.decision === 'FUND' ? `Funded ${decision.repository}.` : decision?.decision === 'PASS_ALL' ? 'Passed on all candidates.' : status === 'working' ? 'Evaluating the discovered candidates.' : 'Waiting for candidate evidence.';
    } else if (key === 'resurrection') {
      const repair = run?.repair;
      outputLines = repair ? [repair.repository, repair.summary, repair.revision ? 'Original source verified' : ''].filter(Boolean) : [];
      summary = repair?.status === 'READY' && status === 'complete' ? 'Recovery verified and ready for product generation.' : status === 'working' ? 'Running and repairing the selected software.' : 'Waiting for an investment decision.';
    } else {
      const product = run?.product;
      outputLines = product ? [product.name, product.description, ...product.limitations].filter(Boolean) : [];
      summary = run?.state === 'live' && product ? `${product.name} is live.` : stage?.status === 'success' && stage.resultStatus !== 'FAILED' ? 'Agent finished; waiting for live product verification.' : status === 'working' ? 'Building the product and its hosted preview.' : 'Waiting for verified software.';
    }
    if ((key === 'resurrection' || key === 'product') && run?.decision?.decision === 'PASS_ALL' && !stage) summary = 'No investment selected; this stage was not started.';
    if (status === 'working') summary = messages.find(event => event.status === 'message')?.text || summary;
    if (status === 'failed') summary = run?.error || messages.find(event => event.status === 'message')?.text || 'This stage stopped before completion.';
    return { ...definition, status, summary, outputLines, messages, ...(stage?.taskId ? { taskId: stage.taskId } : {}) };
  });
}

export function buildAgentHandoffs(run: LiveRun | null): AgentHandoff[] {
  const candidates = run?.candidates || [];
  const decision = run?.decision;
  const repair = run?.repair;
  const labels = [
    candidates.length ? `${candidates.length} candidates` : 'Candidate evidence',
    decision?.decision === 'PASS_ALL' ? 'No investment' : decision?.repository || 'Selected repository',
    repair?.status === 'READY' && repair.revision ? 'Verified software' : 'Verified capability',
  ];
  return definitions.slice(0, -1).map((definition, index) => {
    const next = definitions[index + 1];
    const handedOff = Boolean(run?.stages.some(stage => stage.kind === next.key));
    return { from: definition.key, to: next.key, label: labels[index], status: handedOff ? 'complete' : statusFor(run, definition.key) === 'failed' ? 'failed' : 'waiting' };
  });
}
