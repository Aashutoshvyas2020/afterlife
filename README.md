# Afterlife

Afterlife discovers useful open-source repositories and turns a selected capability into a usable, hosted product. The public console starts real Brainbase agents; it has no preset repository, winner, or timed success sequence.

## Current flow

1. Describe an opportunity or include candidate GitHub URLs.
2. **Scout** searches the chosen sector and inspects current repository metadata, licenses and source. Maintained and popular projects are equally eligible; age and abandonment receive no preference. Only verified licenses allowing commercial use can pass.
3. **Investment manager** funds one candidate, or passes on all of them.
4. **Resurrection engineer** runs the original software, makes the necessary repairs/adaptations, verifies two real inputs and hands off reproducible instructions.
5. **Product engineer** builds a human input form around that capability in its own sandbox, starts a server and tests it.
6. Cloudflare verifies the sandbox health, source manifest, and an actual example execution before exposing the temporary product URL. Each product gets a real Stripe **test** checkout.

The native Brainbase graph runs independently of an open browser. Cloudflare D1 persists run history; a scheduled refresh checks active runs every minute. Refreshing the console also reads actual task state. A failed or rejected run does not become a fake live product.

## Routes and source of truth

| Route | Current behavior |
| --- | --- |
| `/`, `/afterlife/` | Connected agent canvas in the original dark console shell |
| `/product/` | Portfolio of generated products |
| `/product/?run=<id>` | Product provenance, temporary preview and Stripe test checkout |
| `/p/<id>/` | Isolated, proxied generated product; real upstream execution |
| `/api/runs` | Persistent run listing and new discovery request |
| `/api/runs/<id>` | Actual agent chain, evidence, decision, repair and preview state |

**Authoritative current state:** the deployed `/api/runs/<id>` snapshot, backed by the actual Brainbase tasks. `agents/live-config.json` identifies the team's native graph and four agents. Earlier documents and `person1/` evidence describe the previous, fixed DNA recovery run; they are historical, not a new run's outcome.

## Deliberate hackathon limits

- Generated apps run on **temporary Brainbase sandbox URLs**, proxied through the Cloudflare Worker. They can expire; this is not permanent production hosting.
- Previews are free during the hackathon. Stripe creates real test Checkout sessions and verifies product-specific payments on return; this is a monetization demonstration, **not an enforced production paywall**. No real money is charged.
- Public discovery is limited to one active run and ten starts per day to avoid uncontrolled agent spend.
- Recovery and product creation are best-effort. The agents may reject a repository or fail; complex infrastructure, GPU tools and external paid dependencies are out of the quick-launch scope.
- Historical PocketScan and DNA code is retained in source only. No prebuilt demo products or simulated results are exposed in the public app.

## Development

Node 24 is recommended. The static Next.js frontend and Cloudflare API run together through Wrangler:

```sh
npm ci
# Copy .dev.vars.example to .dev.vars and fill server-side credentials locally.
npm run build
npx wrangler d1 migrations apply DB --local
npx wrangler dev
```

Open `http://localhost:8787/afterlife/`. `npm run dev` starts only Next.js, without the Worker APIs. Never commit `.dev.vars` or put API tokens in `NEXT_PUBLIC_*` variables.

Cloudflare requires `BRAINBASE_TOKEN` and `STRIPE_SECRET_KEY` Worker secrets. Run `npm run deploy` with Cloudflare credentials exported in the shell to apply D1 migrations and publish the Worker and static frontend.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

The earlier DNA renderer's Python and integration checks remain available through `npm run test:capability` and `tests/paid-render.integration.mjs`. They verify that earlier product, not arbitrary future agent output.

## Main implementation

- `src/live-runs.js`: native Brainbase task chain, evidence, deployment verification and D1 persistence.
- `src/live-products.js`: isolated preview proxy, product-specific Stripe test checkout and verification.
- `src/components/live-console.tsx`, `live-product.tsx`: current public app.
- `src/components/agent-canvas.css`, `src/lib/agent-canvas.ts`: one-viewport agent canvas, actual handoffs, traces and outputs. Earlier imported designs remain available in `src/designs/`.
- `agents/`: native graph identifiers and actual agent instructions; `scripts/configure-brainbase.py` configures them.
- `src/billing.js`, `person1/`, original designs: preserved prior team work.

See [design provenance](docs/DESIGN-IMPORT.md) and [original team brief](docs/PROJECT-BRIEF.md) for historical context.
