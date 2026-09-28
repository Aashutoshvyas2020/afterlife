"""Import the supplied DC exports without redesigning their DOM or inline styles.
Run with the directory containing the user's HTML exports as the first argument.
"""
from pathlib import Path
import json, re, sys
source = Path(sys.argv[1])
root = Path(__file__).resolve().parents[1]
# Use the supplied template renderer with Next's React, without its standalone
# React/CDN loader, editor bootstrap, or separate React root.
runtime = (source / 'support.js').read_text()
runtime = runtime[runtime.index('  var __defProp'):runtime.index('  // src/index.ts')]
a = runtime.index('  function getReact()')
b = runtime.index('  var h =', a)
runtime = runtime[:a] + '  function getReact() { return React; }\n' + runtime[b:]
# This application never exposes the runtime editor API to incoming messages.
a = runtime.index('    window.addEventListener("message",')
b = runtime.index('    function compile(node)', a)
runtime = runtime[:a] + runtime[b:]
runtime += '''
const components = new Map();
export function createDesignComponent(name, source) {
  if (components.has(name)) return components.get(name);
  const runtime = createRuntime(document);
  runtime.markFetched(name);
  runtime.setRootName(name);
  runtime.adoptParsed(name, source);
  const component = runtime.getDC(name);
  components.set(name, component);
  return component;
}
'''
(root / 'src/vendor/design-runtime.js').write_text('/* eslint-disable */\n// Vendored from the user-supplied support.js; see docs/DESIGN-IMPORT.md.\nimport * as React from "react";\n' + runtime)
for name, filename in [('console', 'Afterlife Console.dc.html'), ('pocketscan', 'PocketScan.dc.html')]:
    raw = (source / filename).read_text()
    template = re.search(r'<x-dc>(.*?)</x-dc>', raw, re.S).group(1)
    logic = re.search(r'<script type="text/x-dc"[^>]*>(.*?)</script>', raw, re.S).group(1)
    template = re.sub(r'<link[^>]*>', '', template)
    for attr in ['stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'fill-rule', 'clip-rule']:
        camel = re.sub(r'-([a-z])', lambda m: m[1].upper(), attr)
        template = template.replace(attr + '=', camel + '=')
    template = template.replace("'Geist Mono'", 'var(--font-geist-mono)').replace("'Geist'", 'var(--font-geist-sans)')
    template = template.replace('https://cdn.jsdelivr.net/npm/3dmol@2.4.0/build/3Dmol-min.js', '/vendor/3Dmol-min.js')
    # Route links stay in the Next app. Keep the original layout and controls.
    logic = logic.replace("'PocketScan.dc.html'", "'/'")
    if name == 'console':
        template = template.replace('>Connected</span>', '>Simulated</span>')
        template = template.replace('Portfolio run · {{ runIdLabel }}', 'Demo run · {{ runIdLabel }}')
    if name == 'pocketscan':
        logic = logic.replace("'https://files.rcsb.org/download/'", "'/structures/'")
        # Label the export's heuristic pocket generation accurately, preserving
        # its real structure viewer and its original interaction model.
        template = template.replace('Protein pocket detection · fpocket 4.0', 'Protein pocket detection · Interactive demo')
        template = template.replace('PocketScan · built on fpocket', 'PocketScan · Demo analysis and payments')
        template = template.replace('fpocket fills the protein surface with alpha spheres and clusters them into candidate pockets.', 'Preview the pocket detection workflow with illustrative, locally generated results.')
        logic = logic.replace("'Computing Voronoi tessellation'", "'Preparing illustrative pocket geometry'")
        logic = logic.replace("'Placing alpha spheres on the surface'", "'Placing demo spheres on the surface'")
        logic = logic.replace("'fpocket alpha-sphere detection on a Voronoi tessellation of the structure, clustered into pockets.'", "'Demo heuristic for interface exploration. Not fpocket or validated scientific analysis.'")
        logic = logic.replace("metaLine: s ? [s.sampleId", "metaLine: s ? ['Demo results', s.sampleId")
        logic = logic.replace("'Top pocket on every scan'", "'Demo access · no payment collected'")
        logic = logic.replace("'$9/month · renews ' + new Date(Date.now() + 30*864e5).toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' })", "'Demo Pro · no subscription or charge'")
        template = template.replace('Upgrade complete', 'Demo upgrade complete')
        template = template.replace('Pay $9 and upgrade', 'Simulate Pro upgrade')
        template = template.replace('All pockets, compare and PDB export are unlocked.', 'Demo access unlocked. No payment or subscription was created.')
        template = template.replace("Nothing changed. You're still on Free.", 'No payment was made. Your existing access is unchanged.')
        logic = logic.replace("get(k, d){ try {", "get(k, d){ if (k === 'pocketscan-pro') { try { return sessionStorage.getItem('pocketscan-demo-pro') === 'true'; } catch(e){ return this.pro || false; } } try {")
        logic = logic.replace("set(k, v){ try {", "set(k, v){ if (k === 'pocketscan-pro') { this.pro = v; try { sessionStorage.setItem('pocketscan-demo-pro', String(v)); } catch(e){} return true; } try {")
        # Reuse existing checkout entry routes with the exact exported modal.
        logic = logic.replace("checkout:null, shortcutsOpen:false", "checkout:this.props.checkout === 'success' && !LS.get('pocketscan-pro', false) ? 'open' : (this.props.checkout ?? null), shortcutsOpen:false")
        # Stop viewer animation on route changes and component unmount.
        logic = logic.replace('if (!el) { this.hero = null;', 'if (!el) { this.hero?.spin(false); this.hero?.clear(); this.hero = null;')
        logic = logic.replace('if (!el) { this.viewer = null;', 'if (!el) { this.viewer?.spin(false); this.viewer?.clear(); this.viewer = null;')
        logic = logic.replace('this.clearTimers(); clearTimeout(this.toastT);', 'this.clearTimers(); clearTimeout(this.toastT); this.hero?.spin(false); this.viewer?.spin(false);')
    (root / ('src/designs/' + name + '.json')).write_text(json.dumps({'template':template, 'js':logic}, indent=2) + '\n')
