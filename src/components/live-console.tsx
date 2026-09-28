"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { OrbState } from 'thinking-orbs';
const ThinkingOrb = dynamic(() => import('thinking-orbs').then(module => module.ThinkingOrb), { ssr: false });
const MetalFx = dynamic(() => import('metal-fx').then(module => module.MetalFx), { ssr: false });
import { liveApi, type LiveRun, type RunSummary } from '@/lib/live-types';
import { buildAgentCanvas, buildAgentHandoffs } from '@/lib/agent-canvas';
import './agent-canvas.css';

const orbStates: Record<string, OrbState> = { scout: 'searching', investment: 'solving', resurrection: 'working', product: 'composing' };
const motionQuery = '(prefers-reduced-motion: reduce)';
function subscribeMotion(change: () => void) { const media = matchMedia(motionQuery); media.addEventListener('change', change); return () => media.removeEventListener('change', change); }
const motionSnapshot = () => matchMedia(motionQuery).matches;
const serverMotionSnapshot = () => true;
const time = (value: string) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export function LiveConsole() {
  const reducedMotion = useSyncExternalStore(subscribeMotion, motionSnapshot, serverMotionSnapshot);
  const [run, setRun] = useState<LiveRun | null>(null);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [id, setId] = useState('');
  const [thesis, setThesis] = useState('');
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selected, setSelected] = useState('');
  const [clock, setClock] = useState(0);
  const hydrated = useRef('');
  const busy = starting || run?.state === 'running' || run?.state === 'starting';

  useEffect(() => {
    let alive = true;
    liveApi<{ runs: RunSummary[] }>('/api/runs').then(data => {
      if (!alive) return;
      setRuns(data.runs);
      const requested = new URLSearchParams(location.search).get('run');
      // Resume active work or the latest published product; archived tests are excluded by the API.
      setId(requested || data.runs.find(item => ['running', 'starting'].includes(item.state))?.id || data.runs.find(item => item.state === 'live')?.id || '');
      setLoaded(true);
    }).catch(reason => { if (alive) { setError(reason.message); setLoaded(true); } });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function poll() {
      try {
        const next = await liveApi<LiveRun>(`/api/runs/${id}`, { signal: controller.signal });
        if (!alive) return;
        if (hydrated.current !== id) { setThesis(next.thesis); hydrated.current = id; }
        setRun(next); setError(next.refreshError || '');
      } catch (reason) { if (alive) setError(reason instanceof Error ? reason.message : 'Could not refresh this run.'); }
      finally { if (alive) timer = setTimeout(poll, 6000); }
    }
    void poll();
    return () => { alive = false; controller.abort(); clearTimeout(timer); };
  }, [id]);

  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => setClock(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(timer);
  }, [busy]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') { event.preventDefault(); setHistoryOpen(value => !value); }
      if (event.key === 'Escape') setHistoryOpen(false);
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, []);

  function choose(next: string) {
    hydrated.current = ''; setRun(null); setSelected(''); setId(next); setHistoryOpen(false);
    history.replaceState(null, '', `?run=${next}`);
  }
  function fresh() {
    if (busy) return;
    hydrated.current = ''; setRun(null); setId(''); setThesis(''); setSelected(''); setError('');
    history.replaceState(null, '', location.pathname);
  }
  async function start() {
    if (busy || !thesis.trim()) return;
    setStarting(true); setError('');
    try {
      const next = await liveApi<{ id: string }>('/api/runs', { method: 'POST', body: JSON.stringify({ thesis }) });
      choose(next.id);
      const list = await liveApi<{ runs: RunSummary[] }>('/api/runs'); setRuns(list.runs);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not start discovery.'); }
    finally { setStarting(false); }
  }

  const nodes = buildAgentCanvas(run);
  const handoffs = buildAgentHandoffs(run);
  const focusedKey = selected || nodes.find(node => node.status === 'working')?.key || (run ? [...nodes].reverse().find(node => node.status === 'complete')?.key : 'scout') || 'scout';
  const focused = nodes.find(node => node.key === focusedKey) || nodes[0];
  const elapsed = run ? Math.max(0, (busy ? Math.max(clock, run.updatedAt || run.createdAt) : run.updatedAt || run.createdAt) - run.createdAt) : 0;
  const elapsedLabel = `${Math.floor(elapsed / 60).toString().padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;
  const live = run?.state === 'live' && Boolean(run.product);
  const complete = nodes.filter(node => node.status === 'complete').length;
  const statusText = !loaded || (id && !run) ? 'Connecting' : live ? 'Product live' : busy ? 'Agents working' : run?.state === 'failed' ? 'Run stopped' : run?.state === 'passed' ? 'No investment' : 'Ready';
  const events = focused.messages.filter(event => event.status === 'message');
  const action = run && !busy ? fresh : () => void start();

  return <div className="agent-console">
    <nav className="ac-rail" aria-label="Navigation">
      <Link href="/" className="ac-symbol" aria-label="Afterlife"><svg width="26" height="26" viewBox="0 0 28 28" fill="none"><path d="M2 15h6l3-8 5 16 3-8h7" stroke="currentColor" strokeWidth="2"/><circle cx="25" cy="15" r="2" fill="#FF6B2C"/></svg></Link>
      <button className="ac-rail-active" aria-label="Workspace" onClick={() => setHistoryOpen(false)}>▱</button>
      <Link href="/product/" aria-label="Products">▤</Link>
      <button aria-label="Recent runs" onClick={() => setHistoryOpen(true)}>⌕</button>
      <span className="ac-avatar">A</span>
    </nav>
    <aside className="ac-sidebar">
      <div className="ac-sidebar-title">Portfolio</div>
      <button className="ac-sidebar-current" onClick={() => setHistoryOpen(false)}>Workspace <span>↗</span></button>
      <div className="ac-sidebar-label">THIS RUN</div>
      <p className="ac-sector-name">{run?.thesis || thesis || 'New discovery'}</p>
      <div className="ac-sidebar-progress"><span style={{ width: `${complete / 4 * 100}%` }}/></div>
      <span className="ac-sidebar-muted">{complete} of 4 agents complete</span>
      <div className="ac-sidebar-bottom"><span><i/> Brainbase</span><span><i/> Cloudflare</span><span>Stripe · test mode</span></div>
    </aside>
    <main className="ac-main">
      <header className="ac-topbar"><span>Workspace <span className="ac-topbar-slash">/</span> Agent canvas</span><button onClick={() => setHistoryOpen(true)}>Recent runs <kbd>⌘K</kbd></button></header>
      <div className="ac-workspace">
        <div className="ac-heading"><div><span className="ac-eyebrow">AFTERLIFE</span><h1>{run?.thesis && run.thesis.length < 50 ? run.thesis : 'Portfolio'}</h1></div><div className="ac-heading-actions"><span className={`ac-run-status ${live ? 'is-live' : ''}`}><i/>{statusText}</span><time>{elapsedLabel}</time></div></div>
        <form className="ac-run-form" onSubmit={event => { event.preventDefault(); if (!run) void start(); }}>
          <input aria-label="Sector" placeholder="Sector or opportunity" maxLength={1500} value={thesis} onChange={event => setThesis(event.target.value)} readOnly={Boolean(busy)} />
          <MetalFx preset="silver" theme="dark" strength={0.45} glowGain={0.25} paused={Boolean(busy) || reducedMotion} normalizeHostStyles={false} borderRadius={7}><button type="button" className="ac-primary" disabled={Boolean(busy) || (!run && !thesis.trim()) || !loaded || Boolean(id && !run)} onClick={action}>{busy ? 'Running…' : run ? 'New run' : 'Discover →'}</button></MetalFx>
        </form>
        {(error || run?.error) && <div className="ac-error" role="alert">{error || run?.error}</div>}
        <section className="ac-canvas" aria-label="Live agent workflow">
          <div className="ac-canvas-caption"><span><i className={busy ? 'ac-live-dot' : ''}/>{live ? 'WORKFLOW COMPLETE' : busy ? 'LIVE EXECUTION' : 'AGENT WORKFLOW'}</span><span>{run?.candidates.length || 0} candidates <b>·</b> {run?.decision?.decision === 'FUND' ? '1 investment' : 'No investment yet'}</span></div>
          <div className="ac-nodes">
            {nodes.map((node, index) => <article key={node.key} className={`ac-node is-${node.status} ${focusedKey === node.key ? 'is-selected' : ''}`}>
              {index < nodes.length - 1 && <div className={`ac-connection ${nodes[index + 1].status !== 'waiting' ? 'is-transferred' : ''}`} aria-hidden="true"><span/><b>›</b></div>}
              <button className="ac-node-select" onClick={() => setSelected(node.key)} aria-pressed={focusedKey === node.key} aria-label={`${node.title}: ${node.status}`}>
                <div className="ac-orb"><ThinkingOrb state={orbStates[node.key]} size={64} theme="dark" speed={0.75} paused={node.status !== 'working' || reducedMotion}/></div>
                <span className="ac-node-number">0{index + 1}</span><h2>{node.title}</h2>
                <span className="ac-node-state"><i/>{node.status === 'working' ? 'Working' : node.status === 'complete' ? 'Complete' : node.status === 'failed' ? 'Stopped' : 'Waiting'}</span>
              </button>
              <p className="ac-node-message">{node.summary}</p>
              <div className="ac-node-output"><span className="ac-output-label">{node.outputTitle}</span>{node.outputLines.length ? node.outputLines.slice(0, 3).map((line, i) => <p key={i}>{line}</p>) : <p className="ac-empty">—</p>}</div>
              {index < nodes.length - 1 && <div className="ac-handoff">{handoffs[index]?.label || 'Awaiting handoff'} <span>→</span></div>}
              {index === 3 && live && <a className="ac-open-product" href={run!.product!.url} target="_blank" rel="noopener noreferrer">Open product ↗</a>}
            </article>)}
          </div>
          <div className="ac-inspector">
            <div className="ac-trace">
              <div className="ac-inspector-heading"><h3>{focused.title} <span>/ activity</span></h3>{selected && <button onClick={() => setSelected('')}>Follow live ↗</button>}</div>
              <div className="ac-trace-scroll" aria-label={`${focused.title} activity`}>
                {events.length ? events.map(event => <div className="ac-trace-event" key={event.id}><time>{time(event.time)}</time><p>{event.text}</p></div>) : <p className="ac-waiting">{busy ? 'Waiting for this agent’s first update.' : 'Activity will appear here.'}</p>}
              </div>
            </div>
            <div className="ac-artifact"><div className="ac-inspector-heading"><h3>{focused.outputTitle}</h3><span className="ac-artifact-state">{focused.status}</span></div><div className="ac-artifact-scroll">
              {focused.key === 'scout' ? run?.candidates.map(candidate => <a key={candidate.repository} href={`https://github.com/${candidate.repository}`} target="_blank" rel="noopener noreferrer"><strong>{candidate.repository} ↗</strong><span>{candidate.license} · {candidate.capability}</span></a>) : focused.key === 'investment' ? <p>{run?.decision?.reason || 'No decision yet.'}</p> : focused.key === 'resurrection' ? <p>{run?.repair?.summary || 'No verified recovery yet.'}</p> : run?.product ? <><a href={run.product.url} target="_blank" rel="noopener noreferrer"><strong>{run.product.name} ↗</strong><span>{run.product.description}</span></a><Link href={`/product/?run=${run.id}`}>Source & test checkout ↗</Link></> : <p>{focused.outputLines.join(' · ') || 'No product published yet.'}</p>}
            </div></div>
          </div>
          <footer className="ac-canvas-footer"><span>{live ? 'Public preview verified' : busy ? 'Connected to native agent tasks' : 'No preselected repository'}</span><span>{live ? 'Temporary URL · Stripe test mode' : 'Messages and outputs from the current run'}</span></footer>
        </section>
      </div>
    </main>
    {historyOpen && <div className="ac-dialog-backdrop" onClick={() => setHistoryOpen(false)}><section className="ac-history" role="dialog" aria-modal="true" aria-label="Recent runs" onClick={event => event.stopPropagation()}><header><h2>Recent runs</h2><button onClick={() => setHistoryOpen(false)} aria-label="Close recent runs">×</button></header>{runs.length ? runs.map(item => <button key={item.id} onClick={() => choose(item.id)}><span>{item.thesis}</span><small>{item.state}</small></button>) : <p>No runs yet.</p>}</section></div>}
  </div>;
}
