"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProductShell } from "@/components/product-shell";
import { api, formatPrice, type ServiceStatus } from "@/lib/service";

export function Checkout({ screen }: { screen: "checkout" | "success" | "cancelled" }) {
  const [status, setStatus] = useState<ServiceStatus | null>(null);
  const [entitled, setEntitled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]);
    const sessionId = new URLSearchParams(window.location.search).get("session_id");
    async function load() {
      try {
        const [service, access] = await Promise.all([api<ServiceStatus>("/api/status", { signal }), api<{ entitled: boolean }>("/api/entitlement", { signal })]);
        let paid = access.entitled === true;
        if (screen === "success" && sessionId) {
          const verified = await api<{ entitled: boolean }>(`/api/checkout/verify?session_id=${encodeURIComponent(sessionId)}`, { signal });
          paid = verified.entitled === true;
        }
        if (!controller.signal.aborted) { setStatus(service); setEntitled(paid); setError(""); }
      } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to verify payment. Please retry."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [screen, attempt]);
  function retry() { setLoading(true); setError(""); setAttempt(value => value + 1); }
  async function startCheckout() {
    setStarting(true); setError("");
    try {
      const data = await api<{ url: string }>("/api/checkout", { method: "POST" });
      const destination = new URL(data.url);
      if (destination.protocol !== "https:" || destination.hostname !== "checkout.stripe.com") throw new Error("Invalid checkout link. Please retry.");
      window.location.assign(destination.href);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not start checkout."); setStarting(false); }
  }
  const ready = status?.stripe.status === "ready" && status?.artifact.status === "ready";
  return <ProductShell><section className="recovered-checkout recovered-card"><p className="service-kicker">DNA FEATURE MAP / STRIPE TEST MODE</p>
    {screen === "checkout" ? <><h1>A new life.<br /><span>One simple price.</span></h1><p className="recovered-muted">One-time test access to generate DNA feature maps. Payment is verified by the service.</p><div className="recovered-plan"><strong>{formatPrice(status?.stripe)}</strong><span>one time · no subscription</span><p>Generate maps from your annotated sequences and download the PNGs.</p></div>{!loading && !ready && <p className="recovered-notice">{status?.artifact.status !== "ready" ? "Checkout opens when the recovered renderer is connected." : "Test billing is not configured yet."}</p>}{entitled ? <><p className="recovered-notice">Your browser already has verified test access.</p><Link href="/product/" className="recovered-primary">Open DNA Feature Map ↗</Link></> : <button onClick={() => void startCheckout()} disabled={loading || starting || !ready || Boolean(error)} className="recovered-primary">{starting ? "Opening Stripe…" : loading ? "Checking availability…" : "Continue to Stripe test checkout ↗"}</button>}<p className="recovered-fine">Use a Stripe test card. No real money is charged. Access is stored in a secure browser cookie; use the same browser after checkout.</p></>
    : screen === "success" ? <><h1>{loading ? "Checking payment…" : entitled ? "You’re ready to create." : "Payment not confirmed yet."}</h1><p className="recovered-muted">{entitled ? "The billing service has confirmed your test access. Your first DNA feature map is one step away." : "We only unlock access after Stripe verifies your payment. If you just returned from checkout, check again in a moment."}</p><Link href="/product/" className="recovered-primary">{entitled ? "Create a feature map ↗" : "Back to product"}</Link></>
    : <><h1>Checkout cancelled.</h1><p className="recovered-muted">You can return whenever you’re ready. Any access you already had is preserved.</p><Link href="/checkout/" className="recovered-primary">Return to checkout ↗</Link><Link href="/product/" className="quiet-button">Back to DNA Feature Map</Link></>}
    {error && <p role="alert" className="recovered-error">{error}</p>}{!starting && <button onClick={retry} disabled={loading} className="quiet-button">{loading ? "Checking…" : "Check status again ↻"}</button>}
    </section></ProductShell>;
}
