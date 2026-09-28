"use client";

import Link from "next/link";
import { StudioHeader } from "@/components/studio";
import { setDemoPro, useDemoPro } from "@/lib/demo-billing";

export function DemoCheckout({ screen }: { screen: "checkout" | "success" | "cancelled" }) {
  const pro = useDemoPro();
  return <main className="studio"><div className="studio-shell">
    <StudioHeader product />
    <section className="checkout-shell surface">
      <p className="eyebrow">POCKETSCAN PRO / DEMO CHECKOUT</p>
      {screen === "checkout" ? <>
        <h1>A little more room<br />for discovery.</h1>
        <p className="muted">Preview the Pro upgrade experience. No card details, no charge, and no subscription will be created.</p>
        <div className="plan-details"><h2>PocketScan Pro</h2><strong>$9 <span>/ month · proposed plan</span></strong><ul><li>All pocket result cards</li><li>Unlimited analyses in the planned product</li><li>Access to the full sample-results demo</li></ul></div>
        {pro && <p className="notice">Demo Pro is already unlocked in this browser tab.</p>}
        <Link href="/checkout/success" onClick={() => setDemoPro(true)} className="primary-button full-width">Simulate successful payment <span aria-hidden="true">↗</span></Link>
        <Link href="/checkout/cancelled" className="secondary-button full-width">Cancel checkout</Link>
        <p className="privacy-note">This is a UI preview. Stripe is not connected.</p>
      </> : screen === "success" ? <>
        <span className="checkout-icon" aria-hidden="true">{pro ? "✓" : "○"}</span>
        <h1>{pro ? "Demo Pro is unlocked." : "No completed demo checkout."}</h1>
        <p className="muted">{pro ? "The payment-success screen is ready. No money was collected. Return to PocketScan and try a sample to see all three result cards." : "Opening this page alone does not unlock Pro. Complete the simulated checkout to preview that state."}</p>
        <Link href={pro ? "/" : "/checkout"} className="primary-button full-width">{pro ? "Open PocketScan" : "Open demo checkout"} ↗</Link>
        {pro && <button className="text-button" onClick={() => setDemoPro(false)}>Reset demo access</button>}
      </> : <>
        <span className="checkout-icon" aria-hidden="true">↶</span><h1>Checkout cancelled.</h1>
        <p className="muted">No payment was made. {pro ? "Your existing demo Pro access is unchanged." : "You can keep using the free preview or try the demo upgrade again."}</p>
        <Link href="/checkout" className="primary-button full-width">Try checkout again ↗</Link><Link href="/" className="secondary-button full-width">Back to PocketScan</Link>
      </>}
    </section>
    <footer className="studio-footer"><span>POCKETSCAN / AN AFTERLIFE PRODUCT</span><span>Simulated payments · No real entitlement or subscription.</span></footer>
  </div></main>;
}
