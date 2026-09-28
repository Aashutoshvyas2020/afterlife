"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { StudioHeader } from "@/components/studio";

import { candidates, duration, milestones, getRunSnapshot, subscribePortfolioRun, type RunScenario } from "@/lib/portfolio";

export default function Afterlife() {
  const [run, setRun] = useState(() => getRunSnapshot(null));
  const [scenario, setScenario] = useState<RunScenario>("success");
  const subscription = useRef<(() => void) | null>(null);
  const { elapsed, invested, live } = run;
  const running = run.status === "running";
  const visibleEvents = run.events;

  useEffect(() => () => subscription.current?.(), []);

  function start(nextScenario = scenario) {
    subscription.current?.();
    subscription.current = subscribePortfolioRun(setRun, nextScenario);
  }
  function reset() {
    subscription.current?.();
    subscription.current = null;
    setRun(getRunSnapshot(null));
  }

  return (
    <main className="studio">
      <div className="studio-shell">
        <StudioHeader />
        <section className="dashboard-intro">
          <div><p className="eyebrow">THE NEXT CHAPTER OF OPEN SOURCE</p><h1>Potential, <span>rediscovered.</span></h1><p className="muted">An autonomous portfolio. From overlooked code to useful products.</p></div>
          <div className="dashboard-actions"><button onClick={() => start()} disabled={running} className="primary-button">{running ? invested ? "Resurrecting…" : "Evaluating…" : run.status === "failed" ? "Retry run" : live ? "Run demo again" : "Evaluate Candidates"}<span aria-hidden="true">↗</span></button><div className="action-caption">{elapsed !== null ? <button onClick={reset} className="text-button">Reset demo</button> : "3 candidates · 10-second evaluation"}</div></div>
        </section>
        <details className="demo-controls"><summary>Demo scenarios</summary><label>Run outcome <select value={scenario} disabled={running} onChange={event => { reset(); setScenario(event.target.value as RunScenario); }}><option value="success">Successful launch</option><option value="evaluation-failure">Evaluation fails</option><option value="repair-failure">Repair fails</option></select></label><p>Scripted scenarios only. Retry repeats the selected scenario.</p></details>
        {run.error && <div role="alert" className="error-notice"><strong>{run.status === "failed" ? "Run stopped. " : ""}</strong>{run.error} <button className="text-button" onClick={() => { setScenario("success"); start("success"); }}>Retry with successful demo</button></div>}
        <div className="portfolio-stats"><Stat label="Available capital" value="$10.00" detail="Operating budget" /><Stat label="Active investments" value={invested ? "01" : "00"} detail={invested ? "fpocket / fpocket" : "Ready for the first decision"} /><Stat label="Products launched" value={live ? "01" : "00"} detail={live ? "PocketScan · Live demo" : "The next chapter is waiting"} /></div>
        <div className="dashboard-grid">
          <div className="portfolio-main">
            <section aria-labelledby="candidates-heading">
              <div className="section-heading"><h2 id="candidates-heading">Discovery queue <span className="count-badge">03</span></h2><span className="micro">01 / EVALUATE</span></div>
              <div className="candidate-grid">{candidates.map((candidate, index) => {
                const status = run.candidates[index];
                const decided = status === "Pass" || status === "Invest";
                const winner = status === "Invest";
                return <article key={candidate.repo} className={"surface candidate-card" + (winner ? " selected" : "")}>
                  <div className="section-heading"><span className="repo-icon" aria-hidden="true">{index === 0 ? "{ }" : index === 1 ? "◎" : "⌘"}</span><span className={"status-pill status-" + status.toLowerCase()}>{status}</span></div>
                  <p className="micro candidate-category">{candidate.category}</p><h3>{candidate.repo}</h3><p className="candidate-description">{candidate.description}</p>
                  <div className="candidate-decision">{decided ? candidate.decision : status === "Failed" ? "Evaluation interrupted. No decision available." : elapsed === null ? "Awaiting agent evaluation." : "Reviewing technical and commercial potential…"}</div>
                  {decided && <details className="decision-evidence"><summary>{winner ? "Why this project won" : "Why we passed"}</summary><dl><dt>Opportunity</dt><dd>{run.reports[index].opportunity}</dd><dt>Proposed product</dt><dd>{run.reports[index].product}</dd><dt>Risks / unknowns</dt><dd>{run.reports[index].risk}</dd><dt>Evidence status</dt><dd>{run.reports[index].validation}</dd></dl><p>Scripted assessment, not verified evidence.</p></details>}
                </article>;
              })}</div>
            </section>
            <section className={"surface resurrection-panel" + (live ? " selected" : "")} aria-labelledby="product-heading">
              <div className="section-heading"><h2 id="product-heading">A second life</h2><span className="micro">02 / RESURRECT</span></div>
              <div className="product-transformation"><div><span className="micro">ORIGINAL ASSET</span><p>fpocket<span className="muted"> / fpocket</span></p><span className="muted small">Protein pocket detection · CLI</span></div><span className="transformation-arrow" aria-hidden="true">→</span><div><span className="micro accent">NEW PRODUCT</span><p>PocketScan<span className="accent">.</span></p><span className="muted small">A friendly interface for research</span></div></div>
              <ol className="milestone-list">{milestones.map((milestone, index) => {
                const done = run.milestones[index] === "Complete";
                const active = run.milestones[index] === "In progress";
                return <li key={milestone.at} className={done ? "done" : active ? "active" : ""}><span aria-hidden="true">{done ? "✓" : "0" + (index + 1)}</span><p>{milestone.label}</p><small>{run.milestones[index]}</small></li>;
              })}</ol>
              <div className="launch-strip">{live ? <><div><p className="eyebrow">PRODUCT LIVE</p><span className="muted small">PocketScan · Pro $9/month</span></div><Link href="/" className="primary-button">Open PocketScan <span aria-hidden="true">↗</span></Link></> : <><span className="status-dot" /><p>{run.error ? "Run stopped. Resolve the failed step before launching." : invested ? "Investment approved. Bringing PocketScan to life." : "Your next product starts with an investment decision."}</p></>}</div>
            </section>
          </div>
          <aside className="surface activity-panel" aria-labelledby="activity-heading">
            <div className="section-heading"><h2 id="activity-heading">Agent activity</h2><span className={"status-dot" + (running ? " running" : "")} /></div>
            <p className="muted small">From the first look to the final launch.</p>
            <div className="run-summary"><span className="micro">{run.status === "failed" ? "RUN FAILED" : live ? "RUN COMPLETE" : running ? "RUN IN PROGRESS" : "AWAITING RUN"}</span><strong>{String(elapsed ?? 0).padStart(2,"0")}<span> / 19s</span></strong><div className="score-track" role="progressbar" aria-label="Demo progress" aria-valuemin={0} aria-valuemax={duration} aria-valuenow={elapsed ?? 0}><span style={{width: ((elapsed ?? 0) / duration) * 100 + "%"}} /></div></div>
            <p className="activity-current" role="status">{live ? "PRODUCT LIVE — demo complete" : visibleEvents.at(-1)?.label ?? "Ready when you are."}</p>
            <ol className="activity-feed">{elapsed === null ? <li className="activity-placeholder"><span className="scan-orbit" aria-hidden="true">↗</span><p>A little conviction.<br />A new beginning.</p><span>Evaluate the candidates to follow each decision and milestone here.</span></li> : [...visibleEvents].reverse().map((event) => <li key={event.at}><span className="event-time">00:{String(event.at).padStart(2,"0")}</span><div><p className={event.at >= 10 ? "accent" : ""}>{event.label}</p><span>{event.detail}</span></div></li>)}</ol>
            <p className="activity-footnote">SIMULATED AGENT EVENTS</p>
          </aside>
        </div>
        <footer className="studio-footer"><span>AFTERLIFE <span className="accent">/</span> SOFTWARE GETS A SECOND CHANCE</span><span>Demo · Evaluations, builds, deployment, and payments are simulated.</span></footer>
      </div>
    </main>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="portfolio-stat"><span className="micro">{label}</span><strong>{value}</strong><span className="muted small">{detail}</span></div>;
}
