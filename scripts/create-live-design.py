"""Preserve the approved console layout, replacing only demo-specific controls and copy."""
import json,re
from pathlib import Path
source=json.loads(Path('src/designs/console.json').read_text())
t=source['template']
t=t.replace('Dead repos. Live products.', 'Portfolio')
t=re.sub(r' *<p[^>]*>Scout overlooked repositories, decide which one to back, then repair, package and launch it.</p>\n', '', t)
# Drop the old embedded PocketScan and checkout templates; those remain in their original export.
a=t.index('    <sc-if value="{{ isPocket }}"');b=t.index('\n  <sc-if value="{{ cmdOpen }}"')
t=t[:a]+'  </main>\n'+t[b:]
a=t.index('  <sc-if value="{{ checkoutOpen }}"');t=t[:a]+'</div>\n'
t=t.replace('Demo run ·','Live run ·').replace('PocketScan','{{ productName }}').replace('From fpocket/fpocket · Free tier plus Pro at $9/month','{{ productDescription }}').replace('Free · Pro $9/mo','Temporary preview').replace('>Live</span>','>PRODUCT LIVE</span>').replace('>Simulated</span>','>{{ i.status }}</span>')
a=t.index('            <div style="display:flex;gap:2px;padding:3px;');b=t.index('            <button onClick="{{ evaluate }}"',a)
t=t[:a]+t[b:]
t=t.replace('Search or run a command','Recent runs and products').replace('Waiting for a run. Press Evaluate candidates.','No activity yet.')
marker='      <div style="padding:24px 24px 64px;'
pos=t.index(marker)
form='''      <section style="padding:22px 24px;border-bottom:1px solid #262626;background:#0A0A0A">
        <textarea aria-label="Sector" id="thesis" value="{{ thesis }}" onChange="{{ thesisInput }}" maxLength="1500" rows="2" style="width:100%;max-width:950px;resize:vertical;border:1px solid #333;border-radius:8px;background:#000;color:#EDEDED;padding:12px;font:14px/1.5 var(--font-geist-sans),sans-serif" placeholder="Sector"></textarea>
      </section>
'''
t=t[:pos]+form+t[pos:]
t=t.replace('  <aside style="flex:0 0 240px;', '  <aside class="live-sidebar" style="flex:0 0 240px;')
t=t.replace('</style>','@media(max-width:900px){.live-sidebar{display:none!important}}\n</style>')
t=t.replace('hint-placeholder-count="3"','hint-placeholder-count="0"')
t=t.replace('color:{{ e.textColor }};text-wrap:pretty','color:{{ e.textColor }};text-wrap:pretty;overflow-wrap:anywhere')
t=re.sub(r' *<span[^>]*>{{ i.role }}</span>\n', '', t)
# Explicit empty state while discovery has not returned candidates.
t=t.replace('              <sc-for list="{{ candidates }}"', '              <sc-if value="{{ noCandidates }}"><p style="padding:20px 18px;color:#8F8F8F;font-size:13px">{{ candidateEmpty }}</p></sc-if>\n              <sc-for list="{{ candidates }}"')
Path('src/designs/console-live.json').write_text(json.dumps({'template':t,'js':'class Component extends DCLogic { renderVals() { return this.props.values; } }'},ensure_ascii=False,indent=2)+'\n')
