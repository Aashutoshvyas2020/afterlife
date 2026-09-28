import Link from "next/link";

export function StudioHeader({ product = false }: { product?: boolean }) {
  return <header className="studio-header">
    <Link href={product ? "/" : "/afterlife"} className="wordmark"><span className="brand-symbol" aria-hidden="true">↗</span>{product ? "pocketscan" : "afterlife"}<span className="brand-period">.</span></Link>
    <nav aria-label="Main navigation"><Link href="/afterlife" aria-current={!product ? "page" : undefined}>Portfolio</Link><Link href="/" aria-current={product ? "page" : undefined}>PocketScan <span aria-hidden="true">↗</span></Link></nav>
    <span className="mode-badge"><i /> TEST MODE</span>
  </header>;
}

export function ProteinIllustration() {
  return <div className="protein-art" aria-hidden="true">
    <svg viewBox="0 0 480 320" fill="none">
      <defs><radialGradient id="protein-glow"><stop stopColor="#9ae8bc" stopOpacity=".18"/><stop offset="1" stopColor="#9ae8bc" stopOpacity="0"/></radialGradient></defs>
      <circle cx="240" cy="160" r="155" fill="url(#protein-glow)"/>
      <g stroke="#34443b" strokeWidth="1"><ellipse cx="240" cy="160" rx="177" ry="100" transform="rotate(-25 240 160)"/><ellipse cx="240" cy="160" rx="177" ry="100" transform="rotate(45 240 160)"/><path d="M35 160H445M240 20V300" strokeDasharray="3 7"/></g>
      <g stroke="#7b9a88" strokeWidth="2" opacity=".8"><path d="M104 164L149 98L207 116L245 69L304 99L346 151L303 205L241 194L191 248L144 214L104 164L180 161L207 116L251 142L304 99M149 98L180 161L144 214M180 161L241 194L251 142L303 205M251 142L346 151M241 194L191 248"/></g>
      <g fill="#a2bcac">{[[104,164],[149,98],[207,116],[245,69],[304,99],[346,151],[303,205],[241,194],[191,248],[144,214],[180,161],[251,142]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r={i%3===0?7:5}/>)}</g>
      <circle cx="251" cy="142" r="32" stroke="#b6f4ca" strokeDasharray="4 4"/><circle cx="251" cy="142" r="23" fill="#b6f4ca" fillOpacity=".12"/><circle cx="251" cy="142" r="7" fill="#c8ffda"/>
      <path d="M279 127L341 67H415" stroke="#b6f4ca"/><text x="345" y="56" fill="#b6f4ca" fontSize="10" fontFamily="monospace">BINDING POCKET</text>
      <text x="28" y="297" fill="#75847b" fontSize="9" fontFamily="monospace">STRUCTURE / ILLUSTRATION</text><text x="372" y="297" fill="#75847b" fontSize="9" fontFamily="monospace">X · Y · Z</text>
    </svg>
  </div>;
}
