"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createSampleProtein } from "@/lib/sample-protein";
import { useDemoPro, setDemoPro } from "@/lib/demo-billing";
import { StudioHeader, ProteinIllustration } from "@/components/studio";
import { analyzeProteinFile, validateProteinFile, type AnalysisResult, type AnalysisScenario } from "@/lib/protein-analysis";

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [results, setResults] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pro = useDemoPro();
  const [scenario, setScenario] = useState<AnalysisScenario>("success");
  const [slow, setSlow] = useState(false);
  const request = useRef<AbortController | null>(null);

  useEffect(() => () => request.current?.abort(), []);

  function selectFile(next: File | null) {
    if (!next) return; // Closing the picker preserves the previous selection.
    request.current?.abort();
    request.current = null;
    setLoading(false);
    setResults(null);
    const validationError = validateProteinFile(next);
    setFile(validationError ? null : next);
    setError(validationError);
  }

  async function analyzeProtein(input = file, outcome = scenario) {
    if (request.current) return;
    const validationError = validateProteinFile(input);
    if (validationError || !input) {
      setError(validationError);
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setSlow(false);
    setResults(null);
    setError(null);
    const slowTimer = setTimeout(() => { if (!controller.signal.aborted) setSlow(true); }, 4000);
    try {
      const result = await analyzeProteinFile(input, { signal: controller.signal, scenario: outcome });
      if (!controller.signal.aborted) setResults(result);
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : "Analysis failed. Please try again.");
      }
    } finally {
      clearTimeout(slowTimer);
      if (request.current === controller) {
        request.current = null;
        setLoading(false);
      }
    }
  }

  function trySample() {
    if (loading) return;
    const sample = createSampleProtein();
    selectFile(sample);
    void analyzeProtein(sample);
  }

  function cancelAnalysis() {
    request.current?.abort();
    request.current = null;
    setLoading(false);
    setSlow(false);
    setError("Analysis cancelled. You can retry when ready.");
  }

  return (
    <main className="studio">
      <div className="studio-shell">
        <StudioHeader product />
        <section className="product-hero">
          <div><p className="eyebrow">COMPUTATIONAL BIOLOGY, MADE ACCESSIBLE</p>
            <h1>A little structure.<br /><span>A lot of possibility.</span></h1>
            <p className="hero-copy">Explore potential binding pockets in protein structures. Start with a PDB file. Leave the command line behind.</p>
            <div className="hero-tags"><span>Inspired by fpocket</span><span>No installation</span><span>Built by Afterlife</span></div>
          </div>
          <ProteinIllustration />
        </section>
        <div className="product-workspace">
          <section className="surface upload-panel" aria-labelledby="upload-heading">
            <div className="section-heading"><span className="eyebrow">01 / INPUT</span><span className="micro">PDB STRUCTURE</span></div>
            <h2 id="upload-heading">Meet your next discovery.</h2><p className="muted">Choose a protein structure to get started.</p>
            <label className={"upload-zone" + (loading ? " is-busy" : "")}>
              <input type="file" accept=".pdb" aria-label="Protein structure (.pdb)" aria-describedby="upload-help" disabled={loading} onChange={(event) => selectFile(event.target.files?.[0] ?? null)} />
              <span className="upload-icon" aria-hidden="true">{file ? "✓" : "↑"}</span>
              <strong>{file ? file.name : "Choose a PDB file"}</strong>
              <span id="upload-help">{file ? "Click to choose a different structure" : ".pdb format · Up to 10 MB"}</span>
              <span className="file-action">{file ? "Change file" : "Browse files"} <span aria-hidden="true">↗</span></span>
            </label>
            <button className="secondary-button full-width" onClick={trySample} disabled={loading}>Try a sample <span aria-hidden="true">↗</span></button>
            <p className="privacy-note">Synthetic demo structure · No file needed.</p>
            {error && <p role="alert" className="error-notice">{error}</p>}
            <button onClick={() => void analyzeProtein()} disabled={loading || !file} className="primary-button full-width">{loading ? "Preparing analysis…" : error && file ? "Retry Analysis" : "Analyze Protein"}<span aria-hidden="true">↗</span></button>
            {loading && <button className="text-button" onClick={cancelAnalysis}>Cancel analysis</button>}
            {error && file && scenario !== "success" && <button className="text-button" onClick={() => { setScenario("success"); void analyzeProtein(file, "success"); }}>Retry with successful demo</button>}
            <p className="privacy-note">Your file stays in your browser during this demo.</p>
          </section>
          <section className="surface result-panel" aria-labelledby="results-heading" aria-busy={loading}>
            <div className="section-heading"><span className="eyebrow">02 / INSIGHTS</span><span className={"status-pill " + (results ? "status-invest" : "")}>{results ? "Complete" : loading ? "Processing" : error ? "Needs attention" : "Awaiting structure"}</span></div>
            <div role="status">
              {loading ? <div className="results-empty"><span className="scan-orbit scanning" aria-hidden="true">◎</span><h2 id="results-heading">Looking beneath the surface.</h2><p>{slow ? "This is taking longer than usual. You can keep waiting or cancel and retry." : "Checking your file and preparing sample pocket results."}</p><p className="filename">{file?.name}</p><div className="loading-track"><span /></div></div>
              : error ? <div className="results-empty"><span className="scan-orbit" aria-hidden="true">!</span><h2 id="results-heading">Let’s try that again.</h2><p>{error}</p><p>Use the file picker or retry controls to continue.</p></div> : results ? <div className="results-content">
                <h2 id="results-heading">{results.pockets.length} {results.mode === "mock" ? "sample binding pockets" : "binding pockets detected"}<span className="accent">.</span></h2>
                <p className="filename">{results.filename}</p>
                {results.pockets.length === 0 && <div className="empty-result"><h3>No pockets found</h3><p>This demo returned no candidate pockets. It does not mean the protein has no binding sites.</p><button className="secondary-button" onClick={() => { setScenario("success"); void analyzeProtein(file, "success"); }}>Try sample results</button></div>}
                <div className="pocket-results">{results.pockets.slice(0, pro ? undefined : 1).map((pocket, index) => <article className="pocket-card" key={pocket.id}>
                  <div className="section-heading"><h3><span className="pocket-index">0{index + 1}</span> Pocket {pocket.id}</h3><span className="micro">{results.mode === "mock" ? "SAMPLE" : "RESULT"}</span></div>
                  <div className="pocket-metrics"><div><span>Druggability</span><strong className="accent">{pocket.druggability.toFixed(2)}</strong></div><div><span>Volume</span><strong>{pocket.volume} <small>Å³</small></strong></div><div><span>Score</span><strong>{pocket.score.toFixed(1)}</strong></div></div>
                  <div className="score-track" aria-hidden="true"><span style={{width: Math.max(0, Math.min(1, pocket.druggability)) * 100 + "%"}} /></div>
                </article>)}</div>
                {results.pockets.length > 1 && !pro && <div className="locked-panel"><span className="eyebrow">PRO PREVIEW · LOCKED</span><h3>{results.pockets.length - 1} more pocket results</h3><p>Explore the upgrade flow to unlock all sample results.</p><Link href="/checkout" className="primary-button">Preview Pro upgrade ↗</Link></div>}
                {pro && results.pockets.length > 0 && <p className="result-disclaimer">Demo Pro unlocked · No payment was collected.</p>}
                {results.mode === "mock" && <p className="result-disclaimer">Illustrative results only. These values are not calculated from your protein.</p>}
              </div> : <div className="results-empty"><span className="scan-orbit" aria-hidden="true">◎</span><h2 id="results-heading">The next insight starts here.</h2><p>Choose a structure, run an analysis, and explore the pocket results in one place.</p><div className="empty-metrics"><span>DRUGGABILITY <b>—</b></span><span>VOLUME <b>—</b></span><span>SCORE <b>—</b></span></div></div>}
            </div>
          </section>
        </div>
        <details className="demo-controls"><summary>Demo scenarios &amp; access</summary><label>Analysis outcome <select disabled={loading} value={scenario} onChange={event => { setScenario(event.target.value as AnalysisScenario); setResults(null); setError(null); }}><option value="success">Sample pockets</option><option value="empty">No pockets found</option><option value="failure">Analysis fails</option><option value="slow">Slow analysis (10 seconds)</option></select></label><p>Scripted UI scenarios. Retry repeats the selected outcome.</p><p>Access: {pro ? "Demo Pro unlocked" : "Free preview — first pocket only"}</p>{pro && <button className="secondary-button" onClick={() => setDemoPro(false)}>Reset demo access</button>}</details>
        <section className="pricing-strip"><div><span className="eyebrow">FOR THE CURIOUS. AND THE COMMITTED.</span><h2>More structures. More possibilities.</h2><p className="muted">PocketScan Pro · Unlimited analyses</p></div><div className="price"><strong>$9<span>/ month</span></strong><Link href="/checkout" className="primary-button">{pro ? "View demo plan" : "Upgrade to Pro"} ↗</Link><span className="micro">DEMO CHECKOUT · NO CHARGE</span></div></section>
        <footer className="studio-footer"><span>POCKETSCAN <span className="accent">/</span> AN AFTERLIFE PRODUCT</span><span>Demo mode · Results are simulated.</span></footer>
      </div>
    </main>
  );
}
