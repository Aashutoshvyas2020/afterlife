// Shared local demo state. This is not payment authorization or backend storage.
export const RUN_KEY = "afterlife-demo-run";
export const PRO_KEY = "pocketscan-demo-pro";
const memory = new Map<string, string>();
function read(key: string) {
  try { return sessionStorage.getItem(key); } catch { return memory.get(key) ?? null; }
}
function write(key: string, value: string | null) {
  if (value === null) memory.delete(key); else memory.set(key, value);
  try { if (value === null) sessionStorage.removeItem(key); else sessionStorage.setItem(key, value); } catch { /* Memory fallback. */ }
}
export function getPro() { return read(PRO_KEY) === "true"; }
export function setPro(value: boolean) { write(PRO_KEY, String(value)); }
export type SavedRun = { started: boolean; t: number; runN: number; scenario: string; runScenario: string; sel: string };
export function loadRun(): Partial<SavedRun> {
  try {
    const run = JSON.parse(read(RUN_KEY) ?? "null");
    if (!run || typeof run.started !== "boolean" || !Number.isFinite(run.t) || run.t < 0 || run.t > 19 || !Number.isInteger(run.runN) || run.runN < 0 || !["success", "eval", "repair"].includes(run.scenario) || !["success", "eval", "repair"].includes(run.runScenario) || !["faker", "fpocket", "carbon"].includes(run.sel)) return {};
    return { started: run.started, t: run.t, runN: run.runN, scenario: run.scenario, runScenario: run.runScenario, sel: run.sel };
  } catch { return {}; }
}
export function saveRun(run: SavedRun) {
  const { started, t, runN, scenario, runScenario, sel } = run;
  write(RUN_KEY, JSON.stringify({ started, t, runN, scenario, runScenario, sel }));
}
export function resetDemo() {
  write(RUN_KEY, null);
  setPro(false);
  write("afterlife-demo-pro", null);
  try {
    const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i));
    for (const key of keys) if (key && (key === "pocketscan-history" || key === "pocketscan-pro" || key.startsWith("pocketscan-pdb-"))) localStorage.removeItem(key);
  } catch { /* Restricted storage must not prevent a reset. */ }
}
