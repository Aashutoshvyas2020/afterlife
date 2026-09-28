import Link from "next/link";

export function StudioHeader({ product = false }: { product?: boolean }) {
  return <header className="studio-header">
    <Link href={product ? "/" : "/afterlife"} className="wordmark"><span className="brand-symbol" aria-hidden="true">↗</span>{product ? "DNA Feature Map" : "afterlife"}<span className="brand-period">.</span></Link>
    <nav aria-label="Main navigation"><Link href="/afterlife" aria-current={!product ? "page" : undefined}>Portfolio</Link><Link href="/" aria-current={product ? "page" : undefined}>DNA Feature Map <span aria-hidden="true">↗</span></Link></nav>
    <span className="mode-badge"><i /> TEST MODE</span>
  </header>;
}
