# Combined project handoff

## Three sources, one application

- UI: `origin/codex/afterlife-demo-ui` at `e55792b`. The original supplied dashboard,
  PocketScan app and landing-page designs remain in `src/designs/*.json`.
- Recovery: `origin/feature/person1-brainbase-core` at `a4f5283`. Scout, Investment,
  Resurrection manifests, recorded native Brainbase execution, pinned DnaFeaturesViewer
  CLI, and canonical alpha fixture. The verified CLI and fixture are unchanged.
- Payments/runtime: `origin/main` at `9236f8b`. Cloudflare Worker, D1, Stripe test
  checkout/verification/webhook, deployment scripts, and regression tests.

The original Next and Worker branches had separate Git roots. Their histories are
combined on the local `codex/afterlife-integrated` branch. No force push or main update.

## Product boundaries

The actual recovered capability is **DNA Feature Map**, not fpocket. It accepts
annotated DNA JSON and renders a PNG; it does not predict function or binding pockets.
The PocketScan UI stays available as a labeled concept demo. Its sessionStorage flag
and Reset demo never grant or remove the Worker’s secure paid-access cookie.

`/checkout`, `/checkout/success`, `/checkout/cancelled` are real test-billing pages for
DNA Feature Map. The original simulated upgrade is `/demo/checkout` and PocketScan’s
embedded preview modal. The console bridge routes its demo upgrade there.

## Real execution path

```text
/product -> /api/product/run {input: JSON}
  -> D1 checks hashed HttpOnly cookie entitlement
  -> HTTP adapter /run (optional Bearer token, required for non-loopback service binding)
  -> unchanged pinned Python CLI
  -> validated PNG + metadata -> browser preview/download
```

`service.py` bounds input size, bases, annotation count, coordinates, figure width,
and subprocess runtime. It uses per-request temporary files and deletes them after
rendering. `Dockerfile` remains the original CLI image definition;
`Dockerfile.service` adds the HTTP entrypoint. Neither image has been built here
because Docker is not installed.

`GET /api/status` reports recorded recovery evidence separately from current renderer
health, Worker scope, Stripe test-price readiness, and public QA. A successful HTTP
200 alone cannot satisfy renderer health: the expected capability identity is required.
The original timed console pipeline never writes these real service states.

Checkout is blocked when renderer health fails. Existing paid browsers cannot start
another checkout and replace their access cookie. Unpaid, foreign-session, wrong-price,
and invalid-webhook paths remain locked. Unsupported API methods return JSON errors,
not the static HTML app. Only explicit Next routes are served as pages.

## Remaining external steps

1. Host `Dockerfile.service` on an appropriate Python/container runtime over HTTPS.
   Set `CAPABILITY_TOKEN` on the service and as a Worker secret. Keep the renderer
   private/authenticated; its raw `/run` endpoint otherwise bypasses the payment gate.
2. Configure Worker `CAPABILITY_BASE_URL` and deploy this combined static export +
   Worker, using the correct account and an approved deployment.
3. Verify the Stripe test price/product wording: Person 3’s original price was named
   PocketScan Pro, but the recovered product is DNA Feature Map. Change the test item
   in Stripe before presenting the paid journey. No Stripe account changes were made.
4. Run hosted Checkout -> verified cookie -> real render/download, cancellation and
   webhook replay against the deployed URL. Public QA stays pending until verified.

The native Brainbase pipeline exists and its run evidence is packaged; no callable
web orchestration API was handed off. A fresh autonomous run, live candidate stream,
autonomous deployment, and revenue reinvestment are not implemented in this app.
