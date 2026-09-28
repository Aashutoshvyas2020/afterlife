# Afterlife UI integration handoff

> UI update: the current routes render the supplied design exports. See
> [DESIGN-IMPORT.md](DESIGN-IMPORT.md) for their runtime and integration boundary.
> The adapters below are retained but do not currently drive those screens.

Everything in this checkout currently uses local demo data. No Brainbase,
fpocket process, deployment API, or Stripe request is made.

## Person 1: portfolio events

Replace `subscribePortfolioRun` in `src/lib/portfolio.ts` with your stream or
polling client. It accepts a callback receiving a complete `RunSnapshot` and
returns an unsubscribe function. The page cleans up on reset, retry, and unmount.
The scenarios are only mock fixtures; remove their controls in live mode.

Map the real run to explicit status, candidate decisions, reports, milestone states,
and event history. `elapsed` is display-only. Never mark a product live because
a timer ended or a stream disconnected. Emit `failed` with a useful error for
failed requests, lost streams, or failed jobs. A retry currently starts a fresh
run; use your backend's run IDs and retry semantics when connected.

Candidate metadata is currently the three fixed demo repos. Candidate reports
are unverified hypotheses, labeled as such. Replace them with Scout evidence;
include sources and timestamps when available. Unknowns must remain unknown.

## Person 1: protein analysis

Replace `analyzeProteinFile` in `src/lib/protein-analysis.ts` with the agreed
backend request. Input: a File and AbortSignal. Output:

    { filename, mode: "live", pockets: [{ id, druggability, volume, score }] }

The UI expects numeric values; volume is in cubic angstroms. Validate the real
response before returning it. An empty pockets array displays an empty state.
Throw a user-friendly Error for failures. Forward the signal to fetch; configure
a timeout appropriate to the real service. The UI provides cancellation and a
slow-request message after four seconds.

Do not place credentials in client code. Use a server route for secret-bearing
provider requests. Agree on the endpoint, upload encoding, auth, units, and
error schema before implementing the real request. Repeat upload validation
on the server. Current client checks are only a size/extension/atom-record screen,
not scientific validation.

`createSampleProtein` supplies a synthetic four-atom UI fixture. It is not a
real protein and must be replaced with a scientifically valid licensed example
before running actual pocket analysis. Mock results do not depend on the file.

## Person 3: billing and deployment

Routes ready for integration:

- `/`: PocketScan, free first-pocket preview and demo Pro results.
- `/afterlife`: portfolio and launch timeline.
- `/checkout`: simulated upgrade, success/cancel controls, proposed $9/month plan.
- `/checkout/success`: success or no-completed-demo-checkout state.
- `/checkout/cancelled`: cancellation and retry.

`src/lib/demo-billing.ts` stores a UI-only flag in sessionStorage with an
in-memory fallback. It is trivially editable and is NOT an entitlement check.
Direct navigation to the success URL does not grant even the demo flag.
Only the explicit "Simulate successful payment" control sets it. Cancellation
preserves any existing demo access. Reset is available in the product's demo
controls and the success screen.

For real payments replace that control with a server-created Stripe Checkout
session and redirect to its returned URL. Verify payment with server-side
webhooks and persist the customer's entitlement. On return, the success screen
must fetch server-confirmed status (including a pending state while processing).
Never grant access from a return URL, client flag, or unverified session ID.
Protect paid analysis/results on the server; hiding cards in React is cosmetic.
Remove the demo access module and all simulation controls for live billing.
Agree on customer identity, checkout endpoint, entitlement endpoint, success and
cancel URLs, and deployment origin. No actual charges are enabled here.

## Local checks

- `npm run lint`
- `npx tsc --noEmit`
- `node --test tests/*.test.mjs` (Node 22.18+ or Node 24; uses native TS stripping)
- `npm run build -- --webpack` (verified fallback for this sandbox's Turbopack restriction)

## Demo walkthrough

1. On `/afterlife`, evaluate candidates; open the winner's explanation.
2. Use Demo scenarios to try evaluation/repair failures. Retry with successful demo.
3. Open PocketScan, then Try a sample. One result is visible; two are locked.
4. Open the Pro preview, cancel and retry, then simulate payment success.
5. Return to PocketScan and Try a sample again to see all three cards.
6. Under Demo scenarios & access, try no pockets, failure, and slow analysis.
7. Reset demo access to show the locked state again.
