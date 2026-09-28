"use client";
/* eslint-disable @next/next/no-img-element -- Render the returned PNG directly; no image server is needed. */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ProductShell } from "@/components/product-shell";
import { api, formatPrice, useService } from "@/lib/service";
import sample from "../../person1/build/dna-feature-map/verification/input_alpha.json";

type Result = { mimeType: string; imageBase64: string; recordId: string; sequenceLength: number; featureCount: number; pngBytes: number; sha256: string };

export function RecoveredProduct() {
  const { status, entitled, loading, error: serviceError, refresh } = useService();
  const [input, setInput] = useState(JSON.stringify(sample, null, 2));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const request = useRef<AbortController | null>(null);
  const fileRequest = useRef(0);
  useEffect(() => () => { request.current?.abort(); fileRequest.current++; }, []);
  const ready = status?.artifact.status === "ready";
  const image = result ? `data:image/png;base64,${result.imageBase64}` : "";
  function cancel() { request.current?.abort(); request.current = null; setBusy(false); }
  function change(value: string) { cancel(); setInput(value); setResult(null); setError(""); }
  async function upload(file?: File) {
    if (!file) return;
    const token = ++fileRequest.current;
    if (file.size > 30000 || !file.name.toLowerCase().endsWith(".json")) { setError("Choose a JSON file smaller than 30 KB."); return; }
    try {
      const value = await file.text();
      if (token !== fileRequest.current) return;
      JSON.parse(value); change(value);
    } catch { if (token === fileRequest.current) setError("Could not read this JSON file. Check its contents and try again."); }
  }
  async function run() {
    let parsed;
    try { parsed = JSON.parse(input); } catch { setError("This is not valid JSON. Check commas and quotes, or load the example."); return; }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || typeof parsed.sequence !== "string" || !Array.isArray(parsed.features)) { setError("Include a sequence string and a features array. Load the example to see the format."); return; }
    if (new TextEncoder().encode(input).length > 30000) { setError("Keep your input below 30 KB."); return; }
    cancel();
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError(""); setResult(null);
    try {
      const response = await api<{ result: Result }>("/api/product/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ input: parsed }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(25000)]) });
      if (!controller.signal.aborted) {
        if (response.result?.mimeType !== "image/png" || !response.result.imageBase64?.startsWith("iVBORw0KGgo")) throw new Error("The renderer returned an invalid image. Please retry.");
        setResult(response.result);
      }
    } catch (cause) { if (!controller.signal.aborted) { setError(cause instanceof Error ? cause.message : "Rendering failed. Please retry."); refresh(); } }
    finally { if (request.current === controller) { setBusy(false); request.current = null; } }
  }
  return <ProductShell>
    <section className="recovered-hero"><p className="service-kicker">RECOVERED PRODUCT / 001</p><h1>Your sequence.<br /><span>A clearer picture.</span></h1><p>Turn annotated DNA into a downloadable feature map. Built from the real DnaFeaturesViewer renderer recovered by Afterlife.</p><div className="recovered-badges"><span>JSON → PNG</span><span>MIT open source</span><span>Stripe test payments only</span></div></section>
    <section className="recovered-status" aria-label="Service readiness"><div><small>RECOVERY</small><strong>{status?.resurrection.status === "ready" ? "Verified handoff" : loading ? "Checking…" : "Unavailable"}</strong></div><div><small>RENDERER</small><strong>{ready ? "Connected" : status?.artifact.status === "failed" ? "Unavailable" : "Pending deployment"}</strong></div><div><small>ACCESS</small><strong>{entitled ? "Verified test access" : "Not purchased"}</strong></div><button onClick={refresh} className="quiet-button">Refresh status ↻</button></section>
    {serviceError && <p role="alert" className="recovered-notice">{serviceError}</p>}
    {!serviceError && !loading && !ready && <p className="recovered-notice">{status?.artifact.error || "The renderer is not connected yet."} You can prepare your input now. Rendering and checkout open when the service is ready.</p>}
    <div className="recovered-grid"><section className="recovered-card"><div className="recovered-section-title"><h2>01 / Prepare your map</h2><button className="quiet-button" onClick={() => { fileRequest.current++; change(JSON.stringify(sample, null, 2)); }}>Load example</button></div><p className="recovered-muted">Start with the verified 488-base example, or upload your own annotated sequence.</p><label className="recovered-upload">Import JSON<input type="file" accept=".json,application/json" onChange={event => { void upload(event.target.files?.[0]); event.target.value = ""; }} /></label><label className="recovered-label" htmlFor="dna-input">Sequence and annotations</label><textarea id="dna-input" spellCheck={false} value={input} onChange={event => { fileRequest.current++; change(event.target.value); }} /><details className="recovered-help"><summary>How to format an input</summary><p>Use id, name, sequence, and features. Each feature has start, end, strand (1 or −1), type, and label; color is optional. Coordinates begin at zero and exclude the end position. Up to 100 features and 20,000 DNA bases; JSON must fit within 30 KB.</p><p>This tool draws the annotations you supply. It does not predict biological function.</p></details>
    {error && <p role="alert" className="recovered-error">{error}</p>}<div className="recovered-buttons">{busy ? <><button className="recovered-primary" disabled>Rendering your map…</button><button className="quiet-button" onClick={cancel}>Cancel</button></> : entitled ? <button className="recovered-primary" disabled={!ready || loading} onClick={() => void run()}>Generate feature map ↗</button> : ready && status?.stripe.status === "ready" ? <Link className="recovered-primary" href="/checkout/">Get test access · {formatPrice(status.stripe)} ↗</Link> : <button className="recovered-primary" disabled>{!ready ? "Waiting for renderer" : "Waiting for test billing"}</button>}</div><p className="recovered-fine">Input is sent to the renderer only when you generate a map. No real money is charged.</p></section>
    <section className="recovered-card recovered-output" aria-live="polite"><div className="recovered-section-title"><h2>02 / Your feature map</h2><span className="service-kicker">{result ? "GENERATED" : busy ? "RENDERING" : "OUTPUT"}</span></div>{result ? <><div className="recovered-image">{/* The renderer returns a validated PNG data URL, not a remote image. */}<img src={image} alt={`DNA feature map for ${result.recordId}`} /></div><div className="recovered-result-meta"><span>{result.sequenceLength.toLocaleString()} bases</span><span>{result.featureCount} annotations</span><span>{(result.pngBytes / 1024).toFixed(1)} KB PNG</span></div><a className="recovered-primary" href={image} download="dna-feature-map.png">Download PNG ↓</a><details className="recovered-help"><summary>Execution details</summary><p>Generated by the recovered renderer during this request.</p><code>SHA-256 {result.sha256}</code></details></> : <div className="recovered-empty"><div aria-hidden="true">── ▰ ── ▱ ─── ▰ ──</div><h3>{busy ? "Drawing your annotations…" : "A map worth a thousand bases."}</h3><p>{busy ? "The recovered Python tool is generating your PNG." : "Your generated map will appear here. Load an example to get started."}</p></div>}</section></div>
    <section className="recovered-card recovered-proof"><div><p className="service-kicker">RECOVERY EVIDENCE</p><h2>Open source, given a second life.</h2><p>Brainbase completed Scout → Investment → Resurrection. The investment decision was FUND, and the JSON-to-PNG tool passed verification. These are recorded results from Person 1’s run, not a new run triggered by this page.</p></div><dl><dt>Source</dt><dd><a href="https://github.com/Edinburgh-Genome-Foundry/DnaFeaturesViewer" target="_blank" rel="noreferrer">Edinburgh-Genome-Foundry / DnaFeaturesViewer ↗</a></dd><dt>Verified revision</dt><dd><code>{status?.resurrection.revision?.slice(0, 12) || "049bbe4e3063"}</code></dd><dt>Brainbase task</dt><dd><code>61dcece3-6760-46d6-bf0c-3d45b94b6e24</code></dd><dt>Public end-to-end QA</dt><dd>{status?.qa.status || "Pending"}</dd></dl></section>
  </ProductShell>;
}
