# Integrated demo runbook

## Local preview

Follow README setup, then `npm run dev:full`. Open http://localhost:8787/afterlife/.

- The original console’s Evaluate candidates is the **PocketScan concept simulation**.
  It is not a new Brainbase task. Reset demo clears only the simulation state/history.
- Open recovered product to see DNA Feature Map and the **recorded Brainbase recovery**.
- The local renderer should show Connected. Without local Stripe keys, access remains
  locked and billing is pending. The real renderer can independently be reproduced:
  `.venv/bin/python person1/build/dna-feature-map/verify.py`.
- `node --test tests/paid-render.integration.mjs` exercises checkout/verification with
  Stripe and D1 fixtures, then calls the real HTTP renderer. This is an integration
  test, not evidence of a live hosted payment.

## Hosted golden path (requires approved deployment)

1. Build/host `person1/build/dna-feature-map/Dockerfile` on a Python container
   runtime. It listens on PORT (8080 by default). Set HOST=0.0.0.0 and a strong
   CAPABILITY_AUTH_TOKEN. Docker build/execution has not been verified on this machine.
2. Configure CAPABILITY_BASE_URL in Worker vars and CAPABILITY_AUTH_TOKEN as a Worker
   secret. It forwards Bearer auth to `/health` and `/run`. Health must return
   `{ "status": "healthy", "service": "dna-feature-map" }`.
3. Existing Cloudflare config targets `afterlife-production` D1 and
   `https://afterlife.afterlife-worker.workers.dev`. The configured one-time Stripe
   price is $5 in test mode. Its previous product name is PocketScan Pro; update that
   wording to DNA Feature Map before demonstrating checkout. Existing secret values
   are remote, not in this checkout. Do not overwrite them to perform a local test.
4. Person 3 recorded the Stripe sandbox as unclaimed, expiring 2026-10-05. Check its
   ownership/expiry before relying on it. `stripe sandbox claim`/`stripe login` or a
   permanent test account may be needed; no account mutation is part of local setup.
5. With approval, `npm run deploy:prod` builds UI, applies **remote** D1 migrations,
   deploys the Worker/assets, and checks health/price. This is not a local command.
6. In a fresh browser, open `/product`, load the example, buy test access, complete
   hosted Stripe test Checkout, and return to `/checkout/success/?session_id=...`.
   Verify access, generate the map, download its PNG, refresh, and run again.
7. In another fresh browser, cancel checkout and confirm it stays locked. Visiting
   success directly must not grant access. Test signed webhook replay independently.

No public renderer is configured in the currently deployed Worker as of the final
review. The combined branch is `codex/afterlife-integrated`. Pushing it does not deploy it.

## Local Stripe testing

Put fresh test credentials in ignored `.dev.vars` (see `.dev.vars.example`). Configure
a local Stripe CLI listener to forward `checkout.session.completed` to
`http://localhost:8787/api/stripe/webhook`. Use that listener’s own signing secret;
it differs from the remote endpoint secret. Keep the same browser throughout the
flow because entitlements use an HttpOnly cookie rather than account identity.

## Smoke script

`scripts/smoke-test.sh URL [input.json]` checks Worker health, test price, renderer,
unpaid denial, and (with `SMOKE_COOKIE_FILE` pointing to a paid cookie jar) execution.
It accepts the canonical raw alpha JSON or an `{ "input": ... }` envelope. No paid
fixture means an explicit incomplete exit, not a full PASS. No secrets in arguments,
screenshots, commits, or reports.

## Honest narration

“Brainbase previously selected and verified this renderer. Here is that recovered
software running through our product and payment layer.” Do not describe loading a
recorded handoff as a new autonomous run, a local test as a public deployment, or
Stripe test transactions as revenue. PocketScan is a separate concept demo.
