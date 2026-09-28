# Afterlife

Afterlife explores turning overlooked open-source software into usable, paid products.
This checkout combines the three hackathon branches: Brainbase recovery, the original
Afterlife/PocketScan UI, and Cloudflare + Stripe test billing.

## What works

- **`/afterlife/`** — the supplied Afterlife Console design, with its explicitly simulated
  fpocket investment/launch walkthrough and a link to the real recovered product.
- **`/`** — the supplied PocketScan landing page and app. Protein pocket results and its
  Pro upgrade remain a labeled demo; the 3D structures are real local sample files.
- **`/product/`** — DNA Feature Map: JSON input → real DnaFeaturesViewer Python renderer →
  downloadable PNG. Uses Person 1’s verified source revision and canonical example.
- **`/checkout/`** — Person 3’s hosted Stripe **test** checkout, with server-verified browser
  access. Requires a connected renderer and configured test keys.
- **`/demo/checkout/`** — PocketScan’s original simulated upgrade. It cannot grant access
  to the recovered product.

Brainbase Scout → Investment → Resurrection evidence is recorded from Person 1’s
verified run. The web app does not start a new Brainbase run. A working local renderer
is not a public deployment. Public paid end-to-end QA remains pending.

## Run locally

Requires Node 24 and Python 3.12+; verified here with Python 3.14 on macOS ARM.

```sh
npm ci
python3 -m venv .venv
.venv/bin/pip install -r person1/build/dna-feature-map/requirements.txt
npm run dev:full
```

Open **http://localhost:8787/afterlife/**. This builds the original Next UI, applies
only local D1 migrations, and starts the Python renderer and local Cloudflare Worker.
No cloud deployment or payment bypass is performed. Without local Stripe test keys,
you can explore the UI and verify renderer health; paid execution stays locked.
`npm run dev` starts just Next.js for UI editing (no Worker API).

For real local test checkout, follow [the runbook](docs/demo-runbook.md). Never copy
remote webhook secrets into local listeners or commit `.dev.vars`.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm run test:capability
.venv/bin/python person1/build/dna-feature-map/verify.py
npm run build
# With the renderer running on port 8090:
node --test tests/paid-render.integration.mjs
```

The HTTP integration test executes the actual Python tool; Stripe and D1 are test
fixtures. It does not claim a hosted Stripe payment was completed.

## Project map

| Component | Location |
| --- | --- |
| Original UI designs and runtime | `src/designs/`, `src/vendor/`, `scripts/import-designs.py` |
| Recovered product and checkout | `src/components/recovered-product.tsx`, `checkout.tsx` |
| Cloudflare API + Stripe/D1 | `src/index.js`, `src/billing.js`, `migrations/` |
| Brainbase agent manifests + evidence | `agents/`, `brainbase-orchestration.yaml`, `docs/person2-contract.md` |
| Unchanged verified CLI + HTTP adapter | `person1/build/dna-feature-map/` |

See [integration details](docs/INTEGRATION.md), [final review](docs/FINAL-REVIEW.md),
[design provenance](docs/DESIGN-IMPORT.md), and [original team brief](docs/PROJECT-BRIEF.md).
Deploy scripts affect the remote Cloudflare account and are separate from local setup.
