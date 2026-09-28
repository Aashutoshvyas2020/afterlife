"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StudioHeader } from "@/components/studio";

type Status = { stripe?: { status?: string; amount?: number; currency?: string } };

export function Checkout({ screen }: { screen: "checkout" | "success" | "cancelled" }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [entitled, setEntitled] = useState(false);
  const [loading, setLoading] = useState(screen === "checkout");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const sessionId = new URLSearchParams(window.location.search).get("session_id");
    async function load() {
      try {
        const [statusResponse, entitlementResponse] = await Promise.all([fetch("/api/status"), fetch("/api/entitlement")]);
        if (!statusResponse.ok || !entitlementResponse.ok) throw new Error("Billing status is temporarily unavailable.");
        const currentStatus = await statusResponse.json();
        let access = Boolean((await entitlementResponse.json()).entitled);
        if (screen === "success" && sessionId) {
          const verify = await fetch(`/api/checkout/verify?session_id=${encodeURIComponent(sessionId)}`);
          if (!verify.ok) throw new Error("Payment verification is pending. Please refresh in a moment.");
          access = Boolean((await verify.json()).entitled);
        }
        if (active) { setStatus(currentStatus); setEntitled(access); }
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : "Unable to check billing status."); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [screen]);
  async function startCheckout() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/checkout", { method: "POST" });
      const data = await response.json();
      if (!response.ok || typeof data.url !== "string") throw new Error(data.error || "Could not start checkout.");
      window.location.assign(data.url);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not start checkout."); setLoading(false); }
  }
  const amount = status?.stripe?.amount;
  const currency = status?.stripe?.currency;
  const fractionDigits = currency ? new Intl.NumberFormat(undefined, { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2 : 2;
  const price = typeof amount === "number" && currency ? new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount / 10 ** fractionDigits) : "Price unavailable";
  return <main className="studio"><div className="studio-shell"><StudioHeader product /><section className="checkout-shell surface"><p className="eyebrow">POCKETSCAN PRO / TEST MODE</p>
    {screen === "checkout" ? <><h1>A little more room<br />for discovery.</h1><p className="muted">One-time test-mode payment. Checkout and access are verified by the billing service.</p><div className="plan-details"><h2>PocketScan Pro</h2><strong>{price}<span> one-time</span></strong><ul><li>Pro access, when granted by the service</li><li>No subscription</li></ul></div>{status?.stripe?.status !== "ready" && <p className="notice">Checkout is not ready yet.</p>}{entitled && <p className="notice">Your account currently has Pro access.</p>}{error && <p role="alert" className="error-notice">{error}</p>}<button onClick={() => void startCheckout()} disabled={loading || status?.stripe?.status !== "ready"} className="primary-button full-width">{loading ? "Checking checkout…" : "Continue to secure checkout"} ↗</button><p className="privacy-note">Test mode · One-time payment · No subscription</p></>
    : screen === "success" ? <><span className="checkout-icon" aria-hidden="true">{entitled ? "✓" : "…"}</span><h1>{loading ? "Verifying payment…" : entitled ? "Pro access confirmed." : "Payment not confirmed."}</h1><p className="muted">{error || (entitled ? "Your access is confirmed by the billing service." : "Access is granted only after the billing service verifies the checkout session.")}</p><Link href="/" className="primary-button full-width">Open PocketScan ↗</Link></>
    : <><span className="checkout-icon" aria-hidden="true">↶</span><h1>Checkout cancelled.</h1><p className="muted">Checkout was cancelled. Any existing access is determined by your account entitlement.</p><Link href="/checkout" className="primary-button full-width">Return to checkout ↗</Link><Link href="/" className="secondary-button full-width">Back to PocketScan</Link></>}
    </section><footer className="studio-footer"><span>POCKETSCAN / AN AFTERLIFE PRODUCT</span><span>Test-mode billing · Entitlement verified by service.</span></footer></div></main>;
}
