import Link from "next/link";
import type { ReactNode } from "react";

export function ProductShell({ children }: { children: ReactNode }) {
  return <main className="recovered-shell"><header className="recovered-nav"><Link href="/afterlife/" className="recovered-brand">afterlife<span>↗</span></Link><nav aria-label="Main navigation"><Link href="/afterlife/">Console</Link><Link href="/product/">DNA Feature Map</Link><Link href="/">PocketScan demo</Link></nav></header>{children}<footer className="recovered-footer"><span>AFTERLIFE / SOFTWARE GETS A SECOND CHANCE</span><span>Recovered with Brainbase · Stripe test mode</span></footer></main>;
}
