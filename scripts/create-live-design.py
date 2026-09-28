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
t=re.sub(r'<button onClick="{{ evaluate }}"[^>]*>{{ runBtnLabel }}</button>', '{{ runAction }}', t)
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
# Live activity uses real task state and narration; animations never advance stages.
t=t.replace('</style>', """
.live-activity{position:relative;overflow:hidden;border:1px solid #333;border-radius:8px;padding:18px;background:#0A0A0A;display:flex;gap:18px;align-items:flex-start}
.live-activity-running{border-color:#6A371F;box-shadow:0 0 24px #FF6B2C08}
.live-run-action:focus-visible{outline:2px solid #FF6B2C!important;outline-offset:4px}
.live-activity-running .live-activity-dot{animation:afterlife-pulse 1.8s ease-in-out infinite}
.live-activity-sweep{position:absolute;bottom:0;left:0;width:30%;height:2px;background:linear-gradient(90deg,transparent,#FF6B2C,transparent);animation:afterlife-sweep 3s ease-in-out infinite}
.live-stage-active{color:#FF6B2C}
@keyframes afterlife-pulse{50%{opacity:.35;box-shadow:0 0 0 5px #FF6B2C15}}
@keyframes afterlife-sweep{0%{transform:translateX(-100%)}100%{transform:translateX(440%)}}
@media(max-width:600px){.live-activity{display:grid;grid-template-columns:64px minmax(0,1fr) auto;gap:12px;align-items:center}.live-activity-info{display:contents}.live-activity-info>div{grid-column:2;grid-row:1}.live-activity-info>p{grid-column:1/-1;grid-row:2;margin:0!important}.live-activity-clock{grid-column:3;grid-row:1}}
@media(prefers-reduced-motion:reduce){.live-activity-dot,.live-activity-sweep{animation:none!important}}
</style>""")
activity="""        <sc-if value="{{ hasLiveActivity }}"><section class="{{ activityClass }}" aria-label="Live activity">
          {{ progressOrb }}<div class="live-activity-info" style="flex:1;min-width:0;padding-top:5px"><div style="font-size:13px;font-weight:600;color:#EDEDED">{{ activityStage }}</div><p style="margin:9px 0 0;font-size:13px;line-height:1.6;color:#A1A1A1;overflow-wrap:anywhere">{{ activityNarration }}</p></div>
          <span class="live-activity-clock" aria-label="Elapsed time" style="font-family:var(--font-geist-mono),monospace;font-variant-numeric:tabular-nums;color:#FF6B2C;font-size:21px">{{ elapsedLabel }}</span>
          <sc-if value="{{ activityRunning }}"><div class="live-activity-sweep" aria-hidden="true"></div></sc-if>
        </section></sc-if>
"""
marker='        <div style="position:relative;display:grid;grid-template-columns:repeat(auto-fill'
t=t.replace(marker,activity+marker)
old='<div style="display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:12px;align-items:center;padding:10px 18px">'
start=t.index(old);end=t.index('                  </div>',start)
t=t[:start]+t[start:end].replace(old,'<button onClick="{{ m.onClick }}" aria-pressed="{{ m.selected }}" style="all:unset;box-sizing:border-box;width:100%;cursor:pointer;display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:12px;align-items:center;padding:10px 18px;background:{{ m.rowBg }}">')+'                  </button>'+t[end+len('                  </div>'):]
t=t.replace('{{ eventCount }}</span>', '{{ eventCount }}</span><sc-if value="{{ stageFiltered }}"><button onClick="{{ clearStageFilter }}" style="all:unset;cursor:pointer;color:#FF6B2C;font-size:12px">All activity</button></sc-if>')
Path('src/designs/console-live.json').write_text(json.dumps({'template':t,'js':'class Component extends DCLogic { renderVals() { return this.props.values; } }'},ensure_ascii=False,indent=2)+'\n')
