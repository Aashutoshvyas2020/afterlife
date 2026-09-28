# Live verification — 28 September 2026

This records observed results, not guarantees about arbitrary future repositories.

## Public app

- URL: https://afterlife.afterlife-worker.workers.dev
- Source branch: `codex/afterlife-integrated`; published using `roanshdesai`. Main was not pushed.
- The original console layout is retained. Thinking Orb state, elapsed time and stage filters reflect actual task activity. MetalFx is limited to the primary action. Desktop, 390px mobile and reduced-motion behavior were checked.
- Lint, TypeScript and production build pass. All 64 Node tests pass; this suite includes historical product tests as well as the current live engine. Long agent histories are read beyond the provider's default 200-message window.

## First generated product

Run: `e5674bd9-dbd7-4042-ade9-c170613ae713`.

Scout discovered three real candidates. The investment manager selected `OlivierBinette/CSVMeta`, MIT, at revision `e321d4b27542fedd4743867b8dd8c35bc606b835`. The original library required no source repair; the agents reproduced its behavior and built a web product around it. This repository was not supplied as a preset winner.

The product stayed reachable after its Brainbase task finished. Its server runs in the existing sandbox's native Daytona background session. One-shot detached processes had failed; the canonical Product prompt now uses the verified persistent-session mechanism.

Observed through the public Cloudflare `/p/<run>/` route:

- Original-library execution with two independent API inputs.
- Browser form submission with custom rows including Unicode, rendered output and metadata.
- Example loading with CRLF and custom submission with LF.
- Downloaded ZIP containing the actual input-derived `data.csv`, `metadata.json` and MIT license.
- Helpful errors for malformed JSON and invalid empty rows.
- Working product-to-checkout navigation without CSP or script errors.

Initial setup required manual recovery of missing native handoffs, sandbox startup limits and server lifetime. These became generic recovery code and canonical instructions. Browser QA also found and repaired a form newline-serialization bug. The first run is evidence of real execution, not evidence that every run is intervention-free.

## Stripe test payment

Completed hosted Stripe checkout with its test card, returned to the product page and observed **Payment verified**. Access remained verified after revisiting without the checkout-session query. Requesting the same paid session without its owning browser cookie returned 403.

Only test payments are enabled. The preview remains free; this is not an enforced production paywall.

## Limits

Temporary sandbox previews can expire or sleep. Repository suitability, licensing evidence, dependency setup and generated UI quality still require per-run verification. Public runs are capped at one active run and ten starts per day. No result is declared live solely because a task ended successfully: the host requires matching source provenance and a successful example execution.
