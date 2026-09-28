# Afterlife

**Afterlife autonomously turns neglected software into real, human-facing businesses.**

The internet is full of useful open-source projects that never became products, or that stopped being maintained because nobody wanted to do the last 80%: understand the code, repair it, package it, design a usable experience, deploy it, price it, add billing, and keep it operating.

Afterlife treats neglected software like an investable asset.

Give Afterlife several candidate repositories and a limited operating budget. Its agent organization evaluates them, rejects weak candidates, selects one worth funding, resurrects the software, turns the useful capability into a product for humans, deploys it, adds Stripe billing, verifies the full customer experience, and reports whether the asset should continue operating.

## The Core Demo

We should be able to show this entire story in one continuous demo:

1. Afterlife receives 3-5 neglected/open-source repositories.
2. The **Scout** analyzes each repository.
3. The **Investment Committee** rejects weak candidates and chooses one to fund.
4. The **Resurrection Engineer** uses Lazarus or our recovery adapter to make the chosen software callable and working.
5. The recovered capability is handed to the product layer through a defined API/schema.
6. A clean human-facing product is generated/wrapped around it.
7. The product is deployed publicly on Cloudflare.
8. Stripe test-mode billing is attached.
9. A human can visit the product, pay, and successfully use the resurrected capability.
10. Afterlife shows the complete operating history: why it invested, what agents did, what was deployed, what it cost, and whether to continue operating it.

### Demo framing

Before:

> Useful code exists, but it is abandoned, broken, inaccessible, or never productized.

After:

> Afterlife funded it, repaired it, packaged it, deployed it, monetized it, and turned it into a usable business.

The product we are building is **not** "an AI coding agent."

The product is the autonomous organization above the coding tools.

Lazarus is a recovery tool inside Afterlife. Brainbase is the agent/orchestration layer. Cloudflare is the deployment/runtime layer. Stripe is the monetization layer.

## What We Are NOT Building

To keep the hackathon scope controlled:

- We are not building a generic no-code startup generator.
- We are not rewriting Lazarus.
- We are not trying to support every repository or language.
- We are not making a fully autonomous venture fund with real financial investing.
- We are not building agent-to-agent paid tools as the customer product.
- We are not spending the day on auth, analytics, dashboards, or infrastructure that does not improve the demo.
- A fresh resurrection of an arbitrary repository is a stretch goal. The guaranteed demo path may use a known Lazarus-compatible/revived asset.

The required outcome is one believable, end-to-end resurrection into a **human-facing paid product**.

---

# Team Split

The team works in parallel.

Each person owns a complete subsystem with a clear contract to the others. Nobody should wait for another person before building. Use mocks/stubs until the real interfaces are ready.

---

## Person 1 — Aashu
### Agent Brain, Investment Logic, and Resurrection Orchestration

### Mission

Own everything that answers:

**What should Afterlife invest in? Why? Can it be recovered? What working software artifact do the other team members receive?**

Aashu owns the autonomous decision and resurrection pipeline.

He does **not** own customer-facing UI polish, Stripe checkout implementation, or Cloudflare production integration except where needed to expose a stable handoff.

### 1. Brainbase orchestration

Set up the Brainbase project and implement the minimum useful agent organization.

Initial agents:

#### Scout

Inspects every candidate repository and produces structured evidence.

For each repo it should determine:

- repository URL
- repository name
- license
- whether the license appears compatible with the intended use
- last meaningful activity / signs of neglect
- languages and runtime
- what the software actually does
- how difficult it appears to build/run
- dependencies
- compute requirements
- whether it has a clean input -> output capability
- potential human users
- possible product wrapper
- obvious monetization model
- major technical risks
- major legal/licensing risks
- recommendation

Unknowns stay unknown. Do not fabricate confidence.

#### Investment Committee

Consumes the Scout reports and makes a single explicit decision.

Required output:

```json
{
  "decision": "FUND",
  "repository": "owner/repo",
  "reason": "Why this asset is the best candidate",
  "product_hypothesis": "What human-facing product should exist",
  "target_capability": "The exact useful software capability we need recovered",
  "maximum_recovery_budget": 0
}
```

Or:

```json
{
  "decision": "PASS_ALL",
  "reason": "Why none of the supplied assets are worth funding"
}
```

Selection should favor:

- clear user value
- manageable runtime requirements
- commercially usable licensing
- strong input -> output behavior
- low resurrection complexity
- easy-to-understand human-facing product
- plausible monetization
- something visually demonstrable in minutes

#### Resurrection Engineer

Receives only the funded repository and target capability.

Its job is to get the useful software working and produce a predictable handoff for Person 2 and Person 3.

### 2. Lazarus integration

Validate Lazarus immediately.

Determine whether it can run directly in the chosen Brainbase environment.

If Docker/nested virtualization/dependency restrictions make that painful, **stop fighting the environment**. Run Lazarus separately and expose it to Brainbase through a wrapper/tool.

Target internal contract:

```ts
resurrect({
  repositoryUrl,
  targetCapability,
  constraints
}) -> {
  status,
  artifactLocation,
  runCommand,
  inputSchema,
  outputSchema,
  logs,
  verification
}
```

The other team members should never need to know how Lazarus works internally.

### 3. Guarantee a fallback resurrection

Do not make the whole hackathon depend on Lazarus repairing a random repository live.

Maintain three levels:

**A — Best case**  
A new candidate repo is selected and Lazarus successfully resurrects it live.

**B — Safe case**  
A candidate is selected and mapped to an already-known Lazarus-compatible/revived artifact.

**C — Emergency case**  
Use one pre-verified revived artifact and still demonstrate the investment, productization, deployment, billing, and customer flow.

The full Afterlife thesis still works under B or C.

### 4. Structured event stream

Every important action should emit an event that the UI can display.

Suggested shape:

```ts
{
  id: string,
  timestamp: string,
  agent: "scout" | "investment" | "resurrection",
  type: string,
  status: "started" | "completed" | "failed",
  title: string,
  detail?: string,
  data?: object
}
```

Examples:

- Scout started analyzing repo
- License verified
- Runtime risk identified
- Candidate rejected
- Candidate funded
- Lazarus recovery started
- Build failed
- Recovery patch applied
- Verification succeeded
- Artifact ready for productization

### 5. Person 1 handoff

Person 1 is done when the rest of the team can consume:

```ts
GET /api/run/:id
```

or equivalent and receive:

```json
{
  "selectedRepository": "owner/repo",
  "investmentDecision": {},
  "productHypothesis": "...",
  "capability": {
    "endpointOrCommand": "...",
    "inputSchema": {},
    "outputSchema": {}
  },
  "events": []
}
```

### Person 1 definition of done

- Brainbase credentials work.
- Candidate repos can be submitted.
- Scout produces structured analyses.
- Investment Committee chooses FUND or PASS_ALL.
- Selected repo is passed into a resurrection adapter.
- At least one real revived capability is verified working.
- Input/output schema for that capability is stable.
- Agent decisions/events can be consumed by the frontend.
- There is a known-good fallback artifact for demo reliability.

---

## Person 2
### Human Product and Customer Experience

### Mission

Own everything that answers:

**What does the resurrected software become for a normal human, and can someone actually understand and use it?**

Person 2 turns the recovered capability into a convincing product.

They should build against a mock capability immediately instead of waiting for Person 1.

### 1. Build the Afterlife control surface

Create the minimal interface needed to understand the autonomous organization.

Required screens/states:

#### Candidate selection

- add/paste candidate repository URLs
- set an operating/recovery budget if we expose one
- start evaluation

#### Investment pipeline

Show candidate cards with useful real evidence:

- repo
- capability
- license
- viability
- risks
- recommendation
- FUND / PASS outcome

#### Execution timeline

Visualize real Person 1 events:

- scouting
- investment decision
- resurrection
- verification
- handoff
- deployment
- monetization

This should feel like watching an autonomous company operate, not watching fake "AI thinking" animations.

#### Portfolio/result

For the funded asset, show:

- original repository
- what the original software did
- product hypothesis
- recovery state
- product URL
- billing state
- customer-flow verification
- final decision: continue / needs work / kill

### 2. Build the human-facing product wrapper

This is the product that Afterlife creates from the recovered software.

Build a generic shell first.

It should be easy to adapt once Person 1 delivers the real input/output schema.

Minimum product experience:

- clear landing page
- one-sentence value proposition
- one primary CTA
- pricing
- core user input
- loading/progress state
- real recovered-software output
- useful result presentation
- paid/locked state where appropriate
- success/error states

Do not overbuild navigation, settings, auth, teams, analytics, etc.

### 3. Generic capability adapter

Person 2 should initially assume something like:

```ts
POST /api/product/run

{
  "input": {}
}
```

returns:

```json
{
  "success": true,
  "result": {},
  "metadata": {}
}
```

The UI should make it easy to swap the specific input form and results renderer once the funded repo is known.

### 4. Design priorities

Optimize for:

1. judges understanding the concept within 10 seconds
2. clear before/after transformation
3. visible evidence that the software is real
4. polished core workflow
5. demo reliability

Avoid spending time on decorative animation until the entire flow works.

### 5. Person 2 handoff

Person 2 must expose:

- the Afterlife dashboard route
- the generated product route
- the expected capability API contract
- the success state Person 3 should verify after payment

### Person 2 definition of done

- Candidate/input screen exists.
- Investment results can be rendered from structured data.
- Agent event timeline renders real events.
- A funded asset has a portfolio/result page.
- Human-facing product shell is usable with mocked data.
- Real capability can replace the mock with minimal code.
- Core product workflow is understandable without explanation.
- The full customer journey works visually on the demo machine.

---

## Person 3
### Deployment, Stripe, Integration, and Demo Reliability

### Mission

Own everything that answers:

**Can the thing actually run in production, accept payment, and survive the live demo?**

Person 3 is the final integration owner.

If every subsystem works separately but the full demo fails, this role owns fixing the seam.

### 1. Cloudflare production path

Set up the deployment path immediately using a dummy service before the real recovered software exists.

Own:

- Cloudflare project/account configuration
- Workers/Pages/Containers as appropriate
- environment variables/secrets
- public production URL
- API routing
- container runtime if recovered software requires native/Linux dependencies
- basic health checks
- redeployment procedure

The deployment workflow should be deterministic and documented.

### 2. Stripe billing

Implement the minimum real billing path in **Stripe test mode**.

Required:

- product/price
- checkout flow
- successful test payment
- success URL
- cancellation path
- proof in the UI that payment occurred
- entitlement/access gating sufficient for the demo

Do not build a huge subscription platform if a simple Checkout Session + entitlement flag is enough.

The demo must never claim test-mode revenue is real revenue.

### 3. End-to-end integration

Wire together:

Person 1:

```
candidate evaluation
-> funding decision
-> resurrected capability
```

Person 2:

```
Afterlife dashboard
-> human-facing product
```

Person 3:

```
production deployment
-> Stripe
-> verified customer flow
```

### 4. Verification script

Create one repeatable golden-path test.

Example:

1. Reset demo state.
2. Submit known candidate repos.
3. Wait for FUND decision.
4. Confirm recovered capability becomes READY.
5. Open generated product.
6. Start checkout.
7. Complete Stripe test payment.
8. Return to product.
9. Run the real recovered capability.
10. Verify expected result.
11. Show the portfolio/event history.

Run this repeatedly before judging.

### 5. Backup strategy

Own demo resilience:

- known-good production deployment
- known-good Stripe test customer/card flow
- cached/sample input file if needed
- backup result if an external service is temporarily unavailable
- recorded backup demo video
- simple reset procedure
- no last-minute infrastructure changes after feature freeze

### Person 3 definition of done

- Public production URL works.
- Dummy service deployed before waiting on the real artifact.
- Real recovered artifact can be deployed through the same path.
- Stripe test checkout succeeds.
- Paid/unpaid state is correctly reflected.
- Customer can use the actual revived capability after the intended billing step.
- Full golden path has been run successfully multiple times.
- Backup demo exists.
- Team knows exactly how to reset and rerun the demo.

---

# Cross-Team Interfaces

These contracts matter more than internal implementation.

## Person 1 -> Person 2

```json
{
  "selectedRepository": "owner/repo",
  "productHypothesis": "...",
  "capabilityName": "...",
  "inputSchema": {},
  "outputSchema": {},
  "events": []
}
```

## Person 1 -> Person 3

Person 1 must provide a runnable artifact:

- container image, OR
- build directory + Dockerfile, OR
- stable service endpoint

Plus:

- health check
- run command
- required environment variables
- expected input/output
- verification command

## Person 2 -> Person 3

Person 2 must identify:

- generated product route
- checkout entry point
- payment success route
- entitlement requirement
- production API base URL configuration

## Person 3 -> Everyone

Person 3 publishes:

- current production URL
- deployment status
- Stripe test-mode status
- integration status
- exact golden-path test instructions

---

# Parallel Build Rule

Nobody blocks on another person.

While Person 1 builds the real agent/recovery path:

- Person 2 uses mocked investment and capability JSON.
- Person 3 deploys a dummy container/API and implements Stripe against it.

Then mocks are replaced one-by-one.

The sequence is:

```
MOCKED END-TO-END FLOW
        ↓
REAL INVESTMENT DECISION
        ↓
REAL RESURRECTED CAPABILITY
        ↓
REAL DEPLOYMENT
        ↓
REAL STRIPE TEST PAYMENT
        ↓
POLISH
```

Never build the project in the opposite order.

---

# Feature Priority

## P0 — Must work

- candidate repositories supplied
- structured agent evaluation
- FUND/PASS decision
- one working resurrected software capability
- human-facing wrapper
- production deployment
- Stripe test payment
- real post-payment product usage
- visible autonomous event history

## P1 — Strong additions

- live Lazarus repair process
- multiple candidates with visibly different decisions
- budget tracking
- automated deployment from the agent workflow
- final CONTINUE / KILL operating decision

## P2 — Only if everything else is finished

- automatic repo discovery
- automatic marketing/customer acquisition
- real analytics
- dynamic product generation for arbitrary schemas
- sophisticated financial projections
- multiple simultaneously operated portfolio companies

---

# Demo Success Criterion

A judge should understand this without us explaining architecture:

> "You gave Afterlife several neglected software projects. Its agents selected one worth saving, repaired it, turned it into a real product, deployed it, added billing, and a human successfully paid for and used it."

If that statement is visibly true in the demo, the project is successful.
