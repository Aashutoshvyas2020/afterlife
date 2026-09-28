import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import * as session from '../src/lib/demo-session.ts';

function storage() {
  const data = new Map();
  return { getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,String(v)), removeItem:k => data.delete(k), key:i => [...data.keys()][i] ?? null, get length(){return data.size;} };
}
function setup() {
  globalThis.sessionStorage = storage(); globalThis.localStorage = storage();
  session.resetDemo();
}
function load(name, { fetch = async () => { throw new Error('Unexpected fetch'); }, props = {} } = {}) {
  const timers = new Map(), intervals = new Map(), destinations = [];
  let now = 0, serial = 0;
  class Logic {
    constructor(props){ this.props = props; }
    setState(update) { this.state = {...this.state,...(typeof update === 'function' ? update(this.state) : update)}; this.componentDidUpdate?.(); }
  }
  const context = vm.createContext({
    DCLogic: Logic, React:{createElement:()=>null}, sessionStorage, localStorage,
    window:{addEventListener(){},removeEventListener(){}}, fetch, AbortController, DOMException,
    setTimeout:(fn,ms)=>{const id=++serial;timers.set(id,{fn,ms});return id;}, clearTimeout:id=>timers.delete(id),
    setInterval:fn=>{const id=++serial;intervals.set(id,fn);return id;},clearInterval:id=>intervals.delete(id),
    performance:{now:()=>now}, console,
  });
  const source = JSON.parse(readFileSync(new URL('../src/designs/'+name+'.json',import.meta.url),'utf8'));
  const Component = vm.runInContext(source.js+'\nComponent;', context);
  const instance = new Component({demo:{...session,navigate:href=>destinations.push(href)},...props});
  return {instance,destinations,source,tick(ms){now=ms;for(const fn of [...intervals.values()])fn();},finish(){for(const [id,{fn}] of [...timers].sort((a,b)=>a[1].ms-b[1].ms)){if(timers.delete(id))fn();}},timers};
}
const deferred = () => { let resolve; const promise = new Promise(r=>{resolve=r;}); return {promise,resolve}; };
const pdb = readFileSync(new URL('../public/structures/1HSG.pdb',import.meta.url),'utf8');

test('imported console routes every product command to the current product and checkout',()=>{
  setup(); const {instance,destinations}=load('console');
  instance.commands(false).find(c=>c.label==='Open PocketScan').run();
  instance.commands(false).find(c=>c.label==='Upgrade to Pro').run();
  instance.renderVals().tabs.find(tab=>tab.label==='PocketScan').onClick();
  assert.deepEqual(destinations,['/','/checkout','/']); assert.equal(instance.state.view,'portfolio');
});

test('actual console completes, survives navigation, and does not restart a completed run',()=>{
  setup(); const run=load('console'); run.instance.startRun('success');run.tick(19000);
  assert.equal(run.instance.renderVals().isLive,true);
  run.instance.componentWillUnmount();
  const restored=load('console'); restored.instance.componentDidMount();
  assert.equal(restored.instance.renderVals().isLive,true);assert.equal(restored.instance.state.runN,1);
  restored.tick(30000);assert.equal(restored.instance.state.t,19);
  restored.instance.componentWillUnmount();
});

test('actual console resumes an unfinished run and repair failure never launches',()=>{
  setup();let run=load('console');run.instance.startRun('repair');run.tick(10000);run.instance.componentWillUnmount();
  run=load('console');run.instance.componentDidMount();run.tick(3000);
  assert.equal(run.instance.renderVals().isFailed,true);assert.equal(run.instance.renderVals().isLive,false);
  run.instance.componentWillUnmount();
});

test('sample -> results -> upgrade uses shared access; direct success does not grant it',async()=>{
  setup();let run=load('pocketscan',{props:{checkout:'success'}});
  assert.equal(run.instance.state.checkout,'open');assert.equal(session.getPro(),false);
  run=load('pocketscan',{fetch:async()=>({ok:true,text:async()=>pdb})});
  await run.instance.runSample('1HSG');run.finish();
  assert.equal(run.instance.state.phase,'done');assert.ok(run.instance.state.scan.pockets.length>1);
  assert.equal(run.instance.visiblePockets().length,1);
  run.instance.renderVals().payCancel();assert.equal(session.getPro(),false);
  run.instance.renderVals().paySuccess();assert.equal(session.getPro(),true);
  assert.equal(run.instance.visiblePockets().length,run.instance.state.scan.pockets.length);
  assert.equal(load('pocketscan').instance.state.pro,true);
});

test('full reset clears portfolio, Pro, history, and orphaned files but preserves unrelated storage',()=>{
  setup();const run=load('console');run.instance.startRun('success');run.tick(19000);session.setPro(true);
  localStorage.setItem('pocketscan-history','[]');localStorage.setItem('pocketscan-pdb-orphan','data');localStorage.setItem('unrelated','keep');
  const pocket=load('pocketscan');pocket.instance.resetDemo();
  assert.equal(session.getPro(),false);assert.deepEqual(session.loadRun(),{});
  assert.equal(localStorage.getItem('pocketscan-pdb-orphan'),null);assert.equal(localStorage.getItem('pocketscan-history'),null);
  assert.equal(localStorage.getItem('unrelated'),'keep');assert.equal(pocket.instance.state.phase,'idle');
  assert.equal(load('console').instance.renderVals().isLive,false);
});

test('cancelled sample fetch cannot restart analysis even if the fetch resolves after abort',async()=>{
  setup();const pending=deferred();let signal;
  const run=load('pocketscan',{fetch:(_url,options)=>{signal=options.signal;return pending.promise;}});
  const request=run.instance.runSample('1HSG');run.instance.renderVals().cancel();
  assert.equal(signal.aborted,true);pending.resolve({ok:true,text:async()=>pdb});await request;run.finish();
  assert.equal(run.instance.state.phase,'idle');assert.equal(run.instance.state.scan,null);assert.equal(run.instance.state.history.length,0);
});

test('a late older file cannot overwrite a newer selection; read failures remain actionable',async()=>{
  setup();const run=load('pocketscan');const pending=deferred();
  const old=run.instance.validateFile({name:'old.pdb',size:10,text:()=>pending.promise});
  await run.instance.validateFile({name:'new.pdb',size:pdb.length,text:async()=>pdb});
  pending.resolve(pdb);await old;run.finish();assert.equal(run.instance.state.scanName,'new.pdb');
  await run.instance.validateFile({name:'bad.pdb',size:10,text:async()=>{throw new Error('read');}});
  assert.match(run.instance.state.fileError,/Could not read/);assert.equal(run.instance.state.phase,'idle');
});

test('unmount aborts in-flight work without producing results',async()=>{
  setup();const pending=deferred();const run=load('pocketscan',{fetch:()=>pending.promise});
  const request=run.instance.runSample('1HSG');run.instance.componentWillUnmount();
  pending.resolve({ok:true,text:async()=>pdb});await request;run.finish();assert.equal(run.instance.state.scan,null);
});
