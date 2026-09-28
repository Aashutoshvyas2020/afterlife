// All assessments and operations below are scripted demo data.
export const candidates = [
  { repo: "joke2k / faker", category: "Developer tooling", description: "Generate realistic test data for applications.", decision: "Useful tool; limited paid-product differentiation.", at: 6 },
  { repo: "fpocket / fpocket", category: "Computational biology", description: "Detect binding pockets in protein structures.", decision: "Clear opportunity: make a research workflow accessible through a hosted product.", at: 10 },
  { repo: "carbon-app / carbon", category: "Creative tooling", description: "Turn source code into shareable images.", decision: "Crowded category; weaker recurring-revenue opportunity.", at: 8 },
];
export const events = [
  { at: 0, label: "Scout started", detail: "Evaluating three candidate repositories." },
  { at: 3, label: "Technical review", detail: "Checking repair effort and commercial potential." },
  { at: 6, label: "Passed on faker", detail: "Limited product differentiation." },
  { at: 8, label: "Passed on carbon", detail: "Limited recurring-revenue opportunity." },
  { at: 10, label: "Investment approved", detail: "fpocket selected → PocketScan." },
  { at: 11, label: "Resurrection started", detail: "Preparing the fpocket runtime and dependencies." },
  { at: 13, label: "Build repaired", detail: "Build configuration patched; analysis command ready." },
  { at: 15, label: "Product generated", detail: "Upload flow and results interface ready." },
  { at: 17, label: "Deployed", detail: "PocketScan is ready to open." },
  { at: 19, label: "Monetization enabled", detail: "Pro plan configured at $9/month." },
];
export const milestones = events.slice(5);
export const duration = 19;



export type RunScenario = "success" | "evaluation-failure" | "repair-failure";
export type CandidateStatus = "Queued" | "Analyzing" | "Pass" | "Invest" | "Failed";
export type RunSnapshot = {
  elapsed: number | null;
  status: "idle" | "running" | "failed" | "complete";
  invested: boolean;
  live: boolean;
  error: string | null;
  candidates: CandidateStatus[];
  reports: typeof evidence;
  milestones: ("Pending" | "In progress" | "Complete" | "Failed")[];
  events: { at: number; label: string; detail: string }[];
};

export const evidence = [
  { opportunity: "A hosted test-data generator for development teams.", risk: "Many free alternatives; willingness to pay is unverified.", product: "Test-data workspace", validation: "Demand, license, and runtime not verified." },
  { opportunity: "Help researchers explore protein structures without a CLI setup.", risk: "Scientific accuracy, compute cost, and commercial licensing need validation.", product: "PocketScan: upload a PDB and explore binding pockets.", validation: "Research workflow is a demo hypothesis; no live repository audit." },
  { opportunity: "A simple tool for creating shareable code images.", risk: "Crowded category; recurring demand is unverified.", product: "Code-image studio", validation: "Demand, license, and runtime not verified." },
];

// Pure mock reducer. UI consumes explicit statuses, never derives outcomes from a clock.
export function getRunSnapshot(seconds: number | null, scenario: RunScenario = "success"): RunSnapshot {
  const stop = scenario === "evaluation-failure" ? 3 : scenario === "repair-failure" ? 13 : duration;
  const elapsed = seconds === null ? null : Math.min(stop, Math.max(0, seconds));
  const failed = elapsed !== null && elapsed >= stop && scenario !== "success";
  const invested = elapsed !== null && elapsed >= 10;
  const live = !failed && elapsed === duration;
  const error = !failed ? null : scenario === "evaluation-failure"
    ? "Evaluation could not finish. No investment was made. Retry the run to try again."
    : "The repair step failed. PocketScan was not deployed. Retry the run to attempt recovery.";
  return {
    elapsed, invested, live, error, reports: evidence,
    status: elapsed === null ? "idle" : failed ? "failed" : live ? "complete" : "running",
    candidates: candidates.map((candidate, index) => elapsed === null ? "Queued" : failed && scenario === "evaluation-failure" ? "Failed" : elapsed >= candidate.at ? index === 1 ? "Invest" : "Pass" : "Analyzing"),
    milestones: milestones.map((step, index) => failed && scenario === "repair-failure" && index === 1 ? "Failed" : elapsed !== null && elapsed >= step.at ? "Complete" : !failed && invested && (index === 0 || (elapsed ?? 0) >= milestones[index - 1].at) ? "In progress" : "Pending"),
    events: elapsed === null ? [] : [
      ...events.filter(event => event.at <= elapsed && (!failed || event.at < stop)),
      ...(failed ? [{ at: stop, label: scenario === "evaluation-failure" ? "Evaluation failed" : "Build repair failed", detail: error! }] : []),
    ],
  };
}

/** Integration boundary for Person 1: replace this subscription with SSE/polling.
 * Emit full RunSnapshot objects, map real events/statuses, and return cleanup.
 * Errors must emit status=failed; a dropped stream must never imply success.
 */
export function subscribePortfolioRun(onUpdate: (snapshot: RunSnapshot) => void, scenario: RunScenario = "success"): () => void {
  const started = Date.now();
  onUpdate(getRunSnapshot(0, scenario));
  const timer = setInterval(() => {
    const snapshot = getRunSnapshot(Math.floor((Date.now() - started) / 1000), scenario);
    if (snapshot.status !== "running") clearInterval(timer);
    onUpdate(snapshot);
  }, 200);
  return () => clearInterval(timer);
}
