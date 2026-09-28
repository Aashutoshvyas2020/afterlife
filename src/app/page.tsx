"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StudioHeader } from "@/components/studio";
import alphaFixture from "../../person1/build/dna-feature-map/verification/input_alpha.json";

type Status = {
  artifact?: { status?: string; error?: string };
  stripe?: { status?: string; amount?: number; currency?: string };
};
type RenderedMap = {
  recordId: string;
  sequenceLength: number;
  featureCount: number;
  mimeType: "image/png";
  imageBase64: string;
  sha256: string;
};

export default function Home() {
  const [status, setStatus] = useState<Status | null>(null);
  const [entitled, setEntitled] = useState(false);
  const [input, setInput] = useState(() => JSON.stringify(alphaFixture, null, 2));
  const [result, setResult] = useState<RenderedMap | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/status").then(response => response.ok ? response.json() : Promise.reject()),
      fetch("/api/entitlement").then(response => response.ok ? response.json() : Promise.reject()),
    ]).then(([serviceStatus, entitlement]) => {
      if (active) {
        setStatus(serviceStatus);
        setEntitled(Boolean(entitlement.entitled));
      }
    }).catch(() => {
      if (active) setError("Service status is unavailable. Rendering is disabled.");
    });
    return () => { active = false; };
  }, []);

  const artifactReady = status?.artifact?.status === "ready";
  const amount = status?.stripe?.amount;
  const currency = status?.stripe?.currency;
  const fractionDigits = currency
    ? new Intl.NumberFormat(undefined, { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2
    : 2;
  const price = typeof amount === "number" && currency
    ? new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount / 10 ** fractionDigits)
    : "Unavailable";

  async function renderMap() {
    setError("");
    setResult(null);
    setRunning(true);
    try {
      const response = await fetch("/api/product/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input: JSON.parse(input) }),
      });
      const data = await response.json();
      if (!response.ok || data.success !== true) throw new Error(data.error || "The recovered renderer could not complete this request.");
      if (data.result?.mimeType !== "image/png" || typeof data.result.imageBase64 !== "string") {
        throw new Error("The recovered renderer returned an unexpected result.");
      }
      setResult(data.result as RenderedMap);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The recovered renderer is unavailable.");
    } finally {
      setRunning(false);
    }
  }

  return <main className="studio"><div className="studio-shell"><StudioHeader product />
    <section className="product-hero"><div><p className="eyebrow">DnaFeaturesViewer · RECOVERED BY AFTERLIFE</p><h1>Sequence in.<br /><span>Structure out.</span></h1><p className="hero-copy">Turn SeqRecord-shaped DNA data into a rendered feature map using the recovered Python capability.</p><div className="hero-tags"><span>Real DnaFeaturesViewer renderer</span><span>Server-rendered PNG</span><span>One-time test access</span></div></div></section>
    <div className="product-workspace"><section className="surface upload-panel" aria-labelledby="input-heading"><div className="section-heading"><span className="eyebrow">01 / INPUT</span><span className="micro">SEQRECORD JSON</span></div><h2 id="input-heading">Render a DNA feature map.</h2><p className="muted">The canonical alpha fixture is loaded. Edit the SeqRecord JSON or restore the verified example.</p>
      <label className="editor-label" htmlFor="capability-input">Capability input</label><textarea id="capability-input" className="capability-input" spellCheck={false} value={input} onChange={event => setInput(event.target.value)} />
      <button className="text-button" onClick={() => { setInput(JSON.stringify(alphaFixture, null, 2)); setError(""); }}>Restore canonical alpha input</button>
      <p className="privacy-note">{artifactReady ? "Input is sent to the recovered service only after server-verified paid access." : `Renderer ${status?.artifact?.status || "status unknown"}${status?.artifact?.error ? ` — ${status.artifact.error}` : ""}.`}</p>
      {error && <p role="alert" className="error-notice">{error}</p>}<button disabled={!artifactReady || !entitled || running} onClick={() => void renderMap()} className="primary-button full-width">{running ? "Rendering DNA map…" : "Run recovered renderer ↗"}</button>
      <p className="privacy-note">Access: {entitled ? "verified by billing service" : "not verified"} · Test-mode billing only</p></section>
      <section className="surface result-panel" aria-labelledby="results-heading"><div className="section-heading"><span className="eyebrow">02 / RESULT</span><span className="status-pill">{result ? "RENDERED BY PYTHON" : artifactReady ? "READY" : status?.artifact?.status || "CHECKING"}</span></div>
        {result ? <div className="results-content"><h2 id="results-heading">{result.recordId}</h2><p className="filename">{result.sequenceLength} bp · {result.featureCount} features · SHA-256 {result.sha256}</p><img className="feature-map-image" src={`data:${result.mimeType};base64,${result.imageBase64}`} alt={`Rendered DNA feature map for ${result.recordId}`} /></div>
          : <div className="results-empty" role="status"><span className="scan-orbit" aria-hidden="true">◎</span><h2 id="results-heading">{artifactReady ? entitled ? "Ready to render." : "Verify access to render." : "Renderer is not ready."}</h2><p>{artifactReady ? entitled ? "Submit the canonical input or edit the SeqRecord JSON. The displayed PNG will come from the recovered Python renderer." : "Complete the Stripe test checkout to unlock server-side capability execution." : "No result is available. Afterlife will only show a rendered map after the recovered service returns one."}</p></div>}
      </section></div>
    <section className="pricing-strip"><div><span className="eyebrow">A RECOVERED CAPABILITY, READY TO USE</span><h2>From sequence to feature map.</h2><p className="muted">DNA Feature Map · One-time Stripe test-mode payment</p></div><div className="price"><strong>{price}<span> one-time</span></strong><Link href="/checkout" className="primary-button">{entitled ? "Access verified" : "Get test access"} ↗</Link><span className="micro">TEST MODE · NO REAL REVENUE</span></div></section>
    <footer className="studio-footer"><span>DNA FEATURE MAP <span className="accent">/</span> AN AFTERLIFE PRODUCT</span><span>Powered by recovered DnaFeaturesViewer code.</span></footer>
  </div></main>;
}
