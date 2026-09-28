"use client";

import Link from "next/link";
import { useService } from "@/lib/service";

export function ServiceStrip({ console: isConsole = false }: { console?: boolean }) {
  const { status, loading, error, refresh } = useService();
  return <section className="service-strip" aria-label="Recovered product status">
    <div><span className="service-kicker">AFTERLIFE / RECOVERED SOFTWARE</span><strong>DNA Feature Map</strong><span className="service-hint">{loading ? "Checking service…" : error ? "Service unavailable" : status?.artifact.status === "ready" ? "Renderer connected" : status?.artifact.status === "failed" ? "Renderer unavailable" : "Renderer awaiting deployment"}</span></div>
    <div className="service-strip-actions">{error && <button onClick={refresh}>Retry</button>}<Link href="/product/">Open recovered product ↗</Link><span>{isConsole ? "Below: PocketScan concept demo" : "PocketScan: demo analysis"}</span></div>
  </section>;
}
