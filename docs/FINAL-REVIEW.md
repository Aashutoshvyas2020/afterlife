# Final integration review — 2026-09-28

## Outcome

Three branches combined on `codex/afterlife-integrated`; original Afterlife Console, PocketScan app and
landing-page templates preserved. Person 1’s verified CLI/fixtures/manifests remain
unchanged. Person 3’s billing and deployment architecture remains in use.

The combined app connects recorded Brainbase evidence → real DNA rendering →
Cloudflare API → Stripe test entitlement. PocketScan is an explicitly separate demo.
The public deployment has not been changed. Public release is still blocked on the
renderer endpoint and hosted payment verification described below.

## Important findings and fixes

| Severity | Finding | Resolution |
| --- | --- | --- |
| Critical | Teams built different product contracts: protein demo vs DNA renderer | Kept the approved demo; exposed DNA Feature Map separately with correct input, output and checkout identity |
| Critical | Verified renderer was CLI-only; Worker required HTTP | Integrated Person 3’s latest HTTP adapter and Dockerfile; added input limits, known-good input and PNG preview/download |
| High | UI checkout state could be confused with server entitlement | Separate `/demo/checkout` from `/checkout`; Worker authorizes all real execution using D1 + secure cookie |
| High | No real recovered-product path in approved UI | Added a small service link/status strip; original templates, interactions and landing page retained |
| High | Healthy HTTP 200 could be an unrelated endpoint | Require the DNA renderer’s health identity; reject malformed output and unsafe redirects |
| High | Edge runtime rejects Fetch `redirect: error`, despite Node test success | Found in actual Wrangler/browser testing; use manual redirects and reject non-success statuses |
| High | Checkout could sell unavailable capability | Block checkout until renderer health passes, both client and Worker |
| High | Repeated checkout could replace a paid cookie | Deny a new checkout for a browser already entitled |
| Medium | Upstream validation became opaque 502 errors | Preserve bounded input-validation errors; add size/time/coordinate/resource limits |
| Medium | Unsupported API methods could serve HTML | API errors return JSON instead of falling through to static assets |
| Medium | Local Worker status could claim the configured public URL | Report actual request origin and local/public scope |
| Medium | Smoke script could exit successfully without a paid execution | Incomplete paid verification now exits 2; accept canonical raw JSON as well as API envelope |
| Medium | Old setup docs describe incompatible contracts | Consolidated README, integration notes and demo runbook; preserved original brief as historical context |

## Verification

- Production Next.js static export, TypeScript and ESLint pass.
- 37 Node regression tests pass: original imported UI flows, sample validation,
  cancellation/persistence, billing ownership, invalid/unpaid price sessions,
  signed webhook replay/tampering, Worker routing, size limits and service errors.
- Four Python validation tests pass.
- Original alpha verification passes: 488 bases, 3 features, 865 × 255 PNG.
- Payment-to-render integration test passes: mocked Stripe/D1, **real Python HTTP
  execution**, PNG dimensions, bytes and SHA-256 checked. No live Stripe transaction.
- Browser checks run against the actual local Wrangler Worker/static export.
  A temporary **local D1 fixture entitlement** is used for paid rendering checks,
  then removed. It is not a product bypass and does not affect remote D1.
  Confirmed real map preview/download, invalid input feedback, and original layouts.
- Original imported templates/runtime have zero diff against the UI branch.
- Docker image build is unverified: Docker is not installed here.

## Remaining release blockers (external, not hidden as completed)

1. **Public renderer deployment.** The live Worker currently reports no artifact.
   Deploy/authenticate the HTTP renderer and configure CAPABILITY_BASE_URL and
   CAPABILITY_AUTH_TOKEN. Local integration is working; no cloud deployment was performed.
2. **Hosted Stripe golden path.** The live $5 one-time test price is ready. Complete
   real hosted test checkout → cookie verification → map generation/download after
   deployment. Independent public QA remains pending. Test webhook replay there too.
3. **Stripe identity/expiry.** Person 3’s documented product is still named PocketScan
   Pro; align it to DNA Feature Map. Their sandbox is recorded as expiring October 5;
   account ownership/expiry must be checked before demo day. No Stripe changes made.

## Deliberately limited scope

- Brainbase has recorded native orchestration evidence, but no web-facing task-start
  or event API was handed off. Evaluate candidates remains a clearly labeled timed
  demo. Do not narrate it as live Brainbase evaluation.
- No general repository repair platform, automated cloud rollout, real revenue,
  subscriptions, reinvestment loop, user accounts, or production abuse controls.
- Browser entitlement is device/browser-specific. Losing its cookie loses access;
  there is no account-based recovery flow. Adequate for a test-mode hackathon demo.
- Python service is a small synchronous demo runtime with bounded subprocesses,
  not a high-throughput rendering fleet. Use a suitable container host and token.
- PocketScan scores/positions are heuristics, not fpocket or validated scientific
  results. DNA Feature Map draws supplied annotations; it predicts no biology.
- Original console is designed for a desktop presentation. Preserve that layout
  for the hackathon rather than undertaking a late responsive redesign.

Final fetch included Ansh’s late `b895140` and `4d44ac6` commits. The combined branch
uses his `http_adapter.py`, `CAPABILITY_AUTH_TOKEN`, camelCase result contract and
Worker configuration. The duplicate integration adapter was removed.
