# Afterlife — product and implementation context

Use this document to build a separate UI for the same product. It describes the
product, behavior, and integration boundaries; it contains no design direction.

## What Afterlife is

Afterlife is a hackathon project for Brainbase / Anthropic / Cloudflare / Stripe.
Its goal is to turn overlooked open-source software into useful businesses:

1. Discover candidate repositories.
2. Evaluate technical feasibility, customer value, risks, and revenue potential.
3. Decide which candidate deserves investment.
4. Repair and package the selected software.
5. Generate a customer-facing product around its capability.
6. Deploy it and enable payments.
7. Track the resulting product in an autonomous software portfolio.

The current example is **fpocket/fpocket → PocketScan**, a proposed service that
lets users submit protein structure files and inspect potential binding pockets.
Afterlife is the portfolio/operator product; PocketScan is one business it launches.

## Current implementation versus intended system

The current application is a working interactive demo. Evaluation, investment
decisions, repair, deployment, protein results, and payments are all simulated.
There are no real Brainbase, Anthropic, fpocket, Cloudflare, or Stripe calls.
Candidate explanations are scripted hypotheses, not verified repository research.
Do not present mock data as actual scientific findings, revenue, or deployments.

The intended system uses Brainbase for agent orchestration, Anthropic for agent
reasoning, Cloudflare for hosting/runtime, and Stripe for billing. Those
integrations still need to be agreed and implemented by the team.

## Team responsibilities

- **Person 1 — agent/backend:** repo scouting, evidence collection, evaluation,
  investment decisions, repair orchestration, working software capability, and
  the APIs/events consumed by the UI.
- **Person 2 — product/UI:** user interactions, portfolio progress and decisions,
  candidate explanations, upload and results flows, useful errors, and the
  customer-facing payment/access states. The UI displays agent decisions; it
  does not perform real repository evaluation itself.
- **Person 3 — deployment/payments:** deployment/runtime setup, Stripe Checkout,
  verified payment events, and server-enforced paid access.

## Existing routes and behavior

### `/afterlife` — portfolio demo

- Starts with $10 capital, zero active investments, and zero launched products.
- “Evaluate Candidates” starts a repeatable, deterministic mock run.
- Candidates: `joke2k/faker`, `fpocket/fpocket`, and `carbon-app/carbon`.
- Candidates progress from queued to analyzing and then pass or invest.
  “Pass” means decline the investment.
- Faker is passed at about 6 seconds; Carbon at 8 seconds; fpocket wins at 10.
- Each candidate has an explanation covering opportunity, proposed product,
  risks, and unknowns. These are explicitly demo hypotheses.
- The winner progresses through resurrection started, build repaired, product
  generated, deployed, and monetization enabled.
- At about 19 seconds the successful run reaches “PRODUCT LIVE,” with one
  investment, one launched product, and an “Open PocketScan” action linking to `/`.
- Reset/replay is supported. Demo scenarios also cover evaluation failure and
  repair failure, with errors and retry actions.
- Evaluation failure cannot invest or launch. Repair failure cannot complete
  deployment or monetization. A successful retry starts a fresh successful run.

### `/` — PocketScan

- Users select a `.pdb` protein structure file or use a sample fixture.
- Client checks reject the wrong extension, empty files, files larger than
  10 MiB, and content without ATOM or HETATM records. These checks are not
  scientific validation and must also be enforced appropriately by a real server.
- Analysis supports loading, cancellation, retry, readable errors, no-results,
  and slow-request feedback.
- A successful mock analysis returns three fixed pockets with druggability,
  volume in cubic angstroms, and score. Results do not depend on the uploaded file.
- Free access reveals the first pocket; demo Pro reveals all three.
- The sample is a synthetic four-atom fixture for exercising the interaction,
  not a scientifically valid example for real fpocket analysis.
- Demo scenarios include success, no pockets, failure, and slow analysis.

### Billing routes

- `/checkout`: proposed Pro plan at $9/month, with explicit simulated success
  and cancellation actions.
- `/checkout/success`: confirms the demo upgrade if it was actually simulated;
  visiting the URL directly does not grant access.
- `/checkout/cancelled`: cancellation and retry. Cancellation preserves any
  previously enabled demo access.
- No card information is collected and no money is charged.
- Demo access can be reset. It uses a sessionStorage flag with an in-memory
  fallback, which is cosmetic and must never be treated as real authorization.
- Analysis results and selected files are not preserved when leaving the product
  route; after checkout, run the sample or upload again.

## Integration contracts for a replacement UI

### Portfolio run

The current adapter is `src/lib/portfolio.ts`:

```ts
subscribePortfolioRun(onUpdate, scenario): () => void
```

It emits complete snapshots and returns an unsubscribe function. A snapshot
includes elapsed time, run status (`idle`, `running`, `failed`, `complete`),
investment and live flags, error, candidate statuses, candidate reports,
milestone statuses, and event history.

Candidate statuses are `Queued`, `Analyzing`, `Pass`, `Invest`, or `Failed`.
Milestones are `Pending`, `In progress`, `Complete`, or `Failed`.

For real integration, replace the timer adapter with polling or an event stream.
Agree on run IDs, source evidence, timestamps, retry semantics, and event schemas.
Use explicit backend state to determine completion. Elapsed time or a disconnected
stream must never imply a successful launch. Clean up subscriptions on reset,
retry, and unmount, and expose useful failure states.

### Protein analysis

The current adapter is `src/lib/protein-analysis.ts`:

```ts
analyzeProteinFile(file, { signal, scenario? }): Promise<AnalysisResult>

type AnalysisResult = {
  filename: string;
  mode: "mock" | "live";
  pockets: {
    id: string;
    druggability: number;
    volume: number;
    score: number;
  }[];
};
```

An empty array means no results. Failures throw user-friendly errors. Forward
the AbortSignal to real requests and validate backend responses and units.
Agree on upload format, endpoint, authentication, limits, and error schema.
Keep provider credentials on the server. Replace the synthetic sample with a
valid, appropriately licensed protein fixture before real analysis.

### Billing and access

The real backend must create a Stripe Checkout session and return its URL.
Verify payment through server-side webhooks, persist customer entitlements,
and fetch confirmed access when the user returns. Support a pending state while
payment is processing. A URL parameter or browser flag cannot grant paid access.
Enforce paid functionality on the server, and remove demo payment controls when
connecting real billing. Agree on customer identity, checkout and entitlement
endpoints, callback URLs, and deployed origin.

## Current codebase

- Local repository: `/Users/roanshdesai/afterlife-ui`.
- Next.js App Router, React, TypeScript, npm.
- Portfolio route: `src/app/afterlife/page.tsx`.
- PocketScan route: `src/app/page.tsx`.
- Mock run adapter: `src/lib/portfolio.ts`.
- Mock analysis adapter: `src/lib/protein-analysis.ts`.
- Sample fixture: `src/lib/sample-protein.ts`.
- Demo billing state: `src/lib/demo-billing.ts`.
- Checkout behavior: `src/components/demo-checkout.tsx`.
- Additional backend handoff: `docs/INTEGRATION.md`.
- Regression tests: `tests/*.test.mjs`.

No backend credentials are needed to run the current demo. Start it with
`npm install` and `npm run dev`. Before changing Next.js code, follow AGENTS.md
and consult the guides bundled in `node_modules/next/dist/docs/` for this version.

## Verification and acceptance

Existing checks passed before this handoff:

```sh
npm run lint
npx tsc --noEmit
node --test tests/*.test.mjs
npm run build -- --webpack
```

The 13 automated tests cover portfolio outcomes, cleanup, upload validation,
analysis success, failure, cancellation, empty results, and sample handling.
The Node tests require native TypeScript stripping (Node 22.18+ or Node 24).
Webpack was the verified build path because this sandbox restricted Turbopack.

For the replacement UI, preserve these end-to-end behaviors:

1. Evaluate the three candidates, explain the decisions, select fpocket, and
   complete the mock launch before enabling the live-product action.
2. Recover from evaluation and repair failures without falsely claiming success.
3. Analyze a sample or accepted upload, and recover from invalid input or failure.
4. Handle no results, slow requests, cancellation, retry, and repeated runs.
5. Demonstrate free access, upgrade cancellation, simulated upgrade success,
   unlocked results, and access reset.
6. Clearly distinguish simulated capabilities from connected, verified behavior.

## Work still needed for a real product

Connect repository evidence and agent decisions; implement actual repair and
execution; run real fpocket analysis; deploy the services; connect Stripe and
server-enforced entitlements; agree authentication and API contracts; and test
the complete flow against those real services. A separate UI can reuse the
current mock adapters while these integrations are developed.
