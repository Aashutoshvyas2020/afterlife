"""Small functional patches applied after importing the unmodified designs."""
def replace(text, old, new):
    if old not in text:
        raise ValueError('Design export changed; expected: ' + old[:100])
    return text.replace(old, new)

def improve(name, template, logic):
    if name == 'console':
        logic = replace(logic, "window.location.href = '/';", "this.props.demo.navigate('/');")
        logic = replace(logic, "this.setState({ view:'pocket' })", "this.props.demo.navigate('/')")
        logic = replace(logic, "run:() => this.setState({ view:'pocket', checkout:'open' })", "run:() => this.props.demo.navigate('/checkout')")
        logic = replace(logic, "{ label:'Reset access', group:'PocketScan', run:() => { store.set(false); this.setState({ pro:false }); } }", "{ label:'Reset demo', group:'Run', run:() => this.resetRun() }")
        logic = replace(logic, "pro: store.get(), checkout:null, notice:''", "pro: this.props.demo.getPro(), checkout:null, notice:'', ...this.props.demo.loadRun()")
        logic = replace(logic, "  componentDidMount(){", "  componentDidUpdate(){ this.props.demo.saveRun(this.state); }\n  componentDidMount(){\n    if (this.state.started && this.state.t < END[this.state.runScenario]) this.startClock(this.state.t);")
        logic = replace(logic, "componentWillUnmount(){ clearInterval(this.iv);", "componentWillUnmount(){ this.props.demo.saveRun(this.state); clearInterval(this.iv);")
        logic = replace(logic, "    this.t0 = performance.now();\n", "")
        logic = replace(logic, "    this.iv = setInterval(() => {", "    this.startClock(0);\n  }\n  startClock(elapsed){\n    this.t0 = performance.now() - elapsed * 1000 / this.speed();\n    this.iv = setInterval(() => {")
        logic = replace(logic, "resetRun(){ clearInterval(this.iv); this.setState({ started:false, t:0 }); }", "resetRun(){ clearInterval(this.iv); this.clearAnalysis(); this.props.demo.resetDemo(); this.setState({ started:false, t:0, runN:0, scenario:'success', runScenario:'success', sel:'fpocket', pro:false, view:'portfolio', checkout:null }); }")
        template = replace(template, '<sc-if value="{{ started }}" hint-placeholder-val="{{ false }}">', '<sc-if value="{{ true }}" hint-placeholder-val="{{ true }}">')
        template = replace(template, '>Reset</button>', '>Reset demo</button>')
    else:
        logic = replace(logic, "pro: LS.get('pocketscan-pro', false)", "pro: this.props.demo.getPro()")
        logic = replace(logic, "!LS.get('pocketscan-pro', false)", "!this.props.demo.getPro()")
        logic = replace(logic, "LS.set('pocketscan-pro', true)", "this.props.demo.setPro(true)")
        logic = replace(logic, "LS.set('pocketscan-pro', false)", "this.props.demo.setPro(false)")
        logic = replace(logic, "  cache = {};", "  cache = {};\n  requestId = 0;\n  pendingFetch = null;\n  disposed = false;")
        logic = replace(logic, "  componentWillUnmount(){", "  componentWillUnmount(){\n    this.disposed = true; this.cancelPending(); clearTimeout(this.libTimer);")
        logic = replace(logic, "  clearTimers(){", """  cancelPending(){
    this.requestId += 1;
    this.pendingFetch?.abort(); this.pendingFetch = null;
    this.clearTimers();
  }
  resetDemo(){
    this.cancelPending(); this.props.demo.resetDemo();
    this.cache = {}; this.last = null;
    this.setState({ route:'landing', pro:false, history:[], phase:'idle', scan:null, scanName:'', log:[], slow:false, errorMsg:'', fileError:'', checkout:null, compare:[], compareOpen:false, selIdx:0, activeId:null, toast:'', spin:false });
  }
  clearTimers(){""")
        logic = replace(logic, "    if (window.$3Dmol) return cb();", "    if (this.disposed) return;\n    if (window.$3Dmol) return cb();")
        logic = replace(logic, "    setTimeout(() => this.whenLib(cb, tries + 1), 100);", "    this.libTimer = setTimeout(() => this.whenLib(cb, tries + 1), 100);")
        logic = replace(logic, "async fetchSample(id){", "async fetchSample(id, signal){")
        logic = replace(logic, "fetch('/structures/' + id + '.pdb')", "fetch('/structures/' + id + '.pdb', { signal })")
        logic = replace(logic, "    this.cache[id] = t;", "    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');\n    this.cache[id] = t;")
        logic = replace(logic, "  async validateFile(f){", "  async validateFile(f){\n    this.cancelPending(); const token = this.requestId;\n    this.setState({ phase:'idle', scan:null, slow:false });")
        logic = replace(logic, "    const text = await f.text();", "    let text;\n    try { text = await f.text(); } catch { if (token === this.requestId && !this.disposed) this.setState({ fileError:'Could not read this file. Choose it again.' }); return; }\n    if (token !== this.requestId || this.disposed) return;")
        logic = replace(logic, "  async runSample(id){\n    this.clearTimers();", "  async runSample(id){\n    this.cancelPending(); const token = this.requestId;\n    const controller = new AbortController(); this.pendingFetch = controller;")
        logic = replace(logic, "      const text = await this.fetchSample(id);", "      const text = await this.fetchSample(id, controller.signal);\n      if (token !== this.requestId || this.disposed) return;\n      this.pendingFetch = null;")
        logic = replace(logic, "    } catch (e) {\n      this.last = () => this.runSample(id);", "    } catch (e) {\n      if (token !== this.requestId || this.disposed) return;\n      this.pendingFetch = null;\n      this.last = () => this.runSample(id);")
        logic = replace(logic, "  startScan(src, keepLog){\n    this.clearTimers();", "  startScan(src, keepLog){\n    this.cancelPending();")
        logic = replace(logic, "  async openHistory(h){\n    let text = null;", "  async openHistory(h){\n    this.cancelPending(); const token = this.requestId;\n    const controller = new AbortController(); this.pendingFetch = controller;\n    let text = null;")
        logic = replace(logic, "await this.fetchSample(h.sampleId)", "await this.fetchSample(h.sampleId, controller.signal)")
        logic = replace(logic, "    if (!text) return this.notify", "    if (token !== this.requestId || this.disposed) return;\n    this.pendingFetch = null;\n    if (!text) return this.notify")
        logic = replace(logic, "cancel: () => { this.clearTimers();", "cancel: () => { this.cancelPending();")
        logic = replace(logic, "reset: () => { this.clearTimers();", "reset: () => { this.cancelPending();")
        logic = replace(logic, "      goLanding: go('landing'),", "      resetDemo: () => this.resetDemo(),\n      backToConsole: () => this.props.demo.navigate('/afterlife'),\n      goLanding: go('landing'),")
        target = '<button onClick="{{ toggleShortcuts }}"'
        buttons = '<button onClick="{{ backToConsole }}" style="all:unset;cursor:pointer;font-size:12px;color:#A1A1A1">Afterlife ↗</button><button onClick="{{ resetDemo }}" style="all:unset;cursor:pointer;font-size:12px;color:#A1A1A1">Reset demo</button>\n      '
        template = replace(template, target, buttons + target)
    return template, logic
