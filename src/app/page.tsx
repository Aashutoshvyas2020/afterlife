"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StudioHeader, ProteinIllustration } from "@/components/studio";
import { validateProteinFile } from "@/lib/protein-analysis";

type Status = { artifact?: { status?: string }; stripe?: { status?: string; amount?: number; currency?: string } };
export default function Home() {
  const [status, setStatus] = useState<Status | null>(null);
  const [entitled, setEntitled] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    Promise.all([fetch("/api/status").then(response => response.ok ? response.json() : Promise.reject()), fetch("/api/entitlement").then(response => response.ok ? response.json() : Promise.reject())])
      .then(([serviceStatus, entitlement]) => { if (active) { setStatus(serviceStatus); setEntitled(Boolean(entitlement.entitled)); } })
      .catch(() => { if (active) setError("Service status is unavailable. Analysis is disabled."); });
    return () => { active = false; };
  }, []);
  const artifactReady = status?.artifact?.status === "ready";
  const amount = status?.stripe?.amount;
  const currency = status?.stripe?.currency;
  const price = typeof amount === "number" && currency ? new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount / 100) : "Unavailable";
  return <main className="studio"><div className="studio-shell"><StudioHeader product />
    <section className="product-hero"><div><p className="eyebrow">COMPUTATIONAL BIOLOGY, MADE ACCESSIBLE</p><h1>A little structure.<br /><span>A lot of possibility.</span></h1><p className="hero-copy">Explore potential binding pockets in protein structures. Start with a PDB file. Leave the command line behind.</p><div className="hero-tags"><span>Inspired by fpocket</span><span>No installation</span><span>Built by Afterlife</span></div></div><ProteinIllustration /></section>
    <div className="product-workspace"><section className="surface upload-panel" aria-labelledby="upload-heading"><div className="section-heading"><span className="eyebrow">01 / INPUT</span><span className="micro">PDB STRUCTURE</span></div><h2 id="upload-heading">Meet your next discovery.</h2><p className="muted">Choose a protein structure to get started.</p>
      <label className="upload-zone"><input type="file" accept=".pdb" aria-label="Protein structure (.pdb)" onChange={event => { const selected = event.target.files?.[0]; if (!selected) return; const validationError = validateProteinFile(selected); setFile(validationError ? null : selected); setError(validationError || ""); }} /><span className="upload-icon" aria-hidden="true">{file ? "✓" : "↑"}</span><strong>{file?.name || "Choose a PDB file"}</strong><span>{file ? "Click to choose a different structure" : ".pdb format · Up to 10 MB"}</span><span className="file-action">{file ? "Change file" : "Browse files"} ↗</span></label>
      <p className="privacy-note">{artifactReady ? "Analysis is unavailable until the PDB input contract is agreed." : "Analysis service pending. Your file is not uploaded."}</p>
      {error && <p role="alert" className="error-notice">{error}</p>}<button disabled className="primary-button full-width">Analyze Protein ↗</button>
      <p className="privacy-note">Pro access: {entitled ? "confirmed" : "not entitled"}</p><Link href="/product" className="secondary-button full-width">Open capability console for JSON input ↗</Link></section>
      <section className="surface result-panel" aria-labelledby="results-heading"><div className="section-heading"><span className="eyebrow">02 / INSIGHTS</span><span className="status-pill">{artifactReady ? "Input contract pending" : status?.artifact?.status || "Checking service"}</span></div><div className="results-empty" role="status"><span className="scan-orbit" aria-hidden="true">◎</span><h2 id="results-heading">{artifactReady ? "Analysis is not configured." : "Analysis is pending."}</h2><p>{artifactReady ? "The analysis artifact is available, but PDB input format is not yet agreed. No scientific results can be shown until integration is defined." : "No live analysis artifact is available yet. Uploading a file will not produce scientific results."}</p><div className="empty-metrics"><span>DRUGGABILITY <b>—</b></span><span>VOLUME <b>—</b></span><span>SCORE <b>—</b></span></div></div></section></div>
    <section className="pricing-strip"><div><span className="eyebrow">FOR THE CURIOUS. AND THE COMMITTED.</span><h2>More structures. More possibilities.</h2><p className="muted">PocketScan Pro · One-time test-mode payment</p></div><div className="price"><strong>{price}<span> one-time</span></strong><Link href="/checkout" className="primary-button">{entitled ? "Manage access" : "Get Pro"} ↗</Link><span className="micro">TEST MODE</span></div></section>
    <footer className="studio-footer"><span>POCKETSCAN <span className="accent">/</span> AN AFTERLIFE PRODUCT</span><span>Scientific analysis is unavailable until backend input contract handoff.</span></footer>
  </div></main>;
}
