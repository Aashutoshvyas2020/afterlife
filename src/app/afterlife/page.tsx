"use client";

import { useEffect, useState } from "react";
import { StudioHeader } from "@/components/studio";

type ServiceStatus = {
  selectedRepository?: string;
  productName?: string;
  resurrection?: { status?: string; error?: string; decision?: string; sourceRevision?: string };
  artifact?: { status?: string; error?: string };
  deployment?: { status?: string; productionUrl?: string };
  stripe?: { status?: string; amount?: number; currency?: string; priceId?: string };
  qa?: { status?: string; detail?: string };
  latestError?: string | null;
};

export default function Afterlife() {
  const [status, setStatus] = useState<ServiceStatus | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    fetch("/api/status").then(response => { if (!response.ok) throw new Error("Status service unavailable."); return response.json(); })
      .then(value => { if (active) setStatus(value); })
      .catch(() => { if (active) setError("Unable to load live service status."); });
    return () => { active = false; };
  }, []);
  return <main className="studio"><div className="studio-shell"><StudioHeader />
    <section className="dashboard-intro"><div><p className="eyebrow">THE NEXT CHAPTER OF OPEN SOURCE</p><h1>Potential, <span>rediscovered.</span></h1><p className="muted">Portfolio operations and deployment status from the service.</p></div></section>
    {error && <p role="alert" className="error-notice">{error}</p>}
    <div className="portfolio-stats">
      <Stat label="Selected repository" value={status?.selectedRepository || "—"} detail="Reported by /api/status" />
      <Stat label="Artifact" value={status?.artifact?.status || "pending"} detail="Actual service state" />
      <Stat label="Deployment" value={status?.deployment?.status || "pending"} detail="Actual service state" />
    </div>
    <div className="dashboard-grid"><div className="portfolio-main">
      <section aria-labelledby="candidate-heading"><div className="section-heading"><h2 id="candidate-heading">Verified recovery handoff</h2><span className="micro">{status?.resurrection?.decision || "PENDING"}</span></div><article className="surface candidate-card"><p className="muted">{status?.selectedRepository ? `Person 1 selected ${status.selectedRepository}; its verified capability is ${status.productName || "the DNA Feature Map"}.` : "No verified Person 1 recovery handoff is configured."}</p>{status?.resurrection?.sourceRevision && <p className="candidate-decision">Source revision: {status.resurrection.sourceRevision}</p>}{status?.resurrection?.error && <p role="alert" className="error-notice">{status.resurrection.error}</p>}</article></section>
      <section className="surface resurrection-panel"><div className="section-heading"><h2>Service readiness</h2><span className="micro">{status?.resurrection?.status?.toUpperCase() || "PENDING"}</span></div><dl className="decision-evidence"><dt>Resurrection</dt><dd>{status?.resurrection?.status || "pending"}</dd><dt>Artifact</dt><dd>{status?.artifact?.status || "pending"}</dd><dt>Deployment</dt><dd>{status?.deployment?.status || "pending"}</dd><dt>Stripe</dt><dd>{status?.stripe?.status || "pending"}</dd><dt>QA</dt><dd>{status?.qa?.status || "pending"}</dd></dl>{status?.latestError && <p role="alert" className="error-notice">{status.latestError}</p>}</section>
    </div><aside className="surface activity-panel"><div className="section-heading"><h2>Activity</h2><span className="status-dot" /></div><p className="muted small">No live orchestration feed is attached.</p><div className="activity-placeholder"><p>Person 1&apos;s verified handoff is shown above; live activity is not simulated.</p></div></aside></div>
    <footer className="studio-footer"><span>AFTERLIFE <span className="accent">/</span> SOFTWARE GETS A SECOND CHANCE</span><span>Orchestration activity remains unavailable.</span></footer>
  </div></main>;
}
function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="portfolio-stat"><span className="micro">{label}</span><strong>{value}</strong><span className="muted small">{detail}</span></div>;
}
