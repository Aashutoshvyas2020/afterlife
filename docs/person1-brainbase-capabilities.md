# Brainbase capabilities used by Person 1

Brainbase CLI **v0.37.0** was authenticated to Team / General. No credentials, tokens, or auth codes are recorded.

## Clean native execution

Orchestration **Afterlife Person 1**, graph `43440ca3-9869-4437-b5db-a42cce05a0da`, completed cleanly:

- Scout root task `a812f306-4e6d-5572-8b64-f04aecb0800b` succeeded.
- Native Investment child `8aced9ad-5ce6-427f-9504-5d3c035e3487`, via Scout edge `65dbb1e2-aa0c-4f1f-984e-205e9300a237`, succeeded with **FUND**.
- Native Resurrection child `61dcece3-6760-46d6-bf0c-3d45b94b6e24`, via Investment edge `62d9beb2-bece-4ac3-b750-bf3482a268ce`, succeeded with **READY**.
- Investment called native `create_task_for_*` directly; no manual follow-up. Scout's initial handoff lacked required recommendation and Brainbase rejected it; Scout automatically corrected and retried.
- Investment and Resurrection evaluations passed.

Funded source: DnaFeaturesViewer, MIT, source commit `049bbe4e3063e90ae9b0f88ac7e92f47b735d38a`.

## Verified capability evidence

Clean Resurrection task ran:

```sh
.venv/bin/python run_seqrecord_plot.py verification/input_alpha.json verification/output_alpha.png
.venv/bin/python run_seqrecord_plot.py verification/input_beta.json verification/output_beta.png
```

This local CLI consumes SeqRecord-shaped JSON and writes PNG; it is not an HTTP service.

| Fixture | Input SHA-256 | Record / bp / features | PNG dimensions / bytes | Output SHA-256 |
|---|---|---|---|---|
| alpha | `179519ac5b239a8b8d1b54e784157287b1ee9317fba904ef31e239f0478a1ca9` | `alpha_construct` / 488 / 3 | 865×255 / 13,400 | `ebfb506f713ebfedda7fc70fdaad31e2c168a70f95a351c6248f0d288617d0d1` |
| beta | `6caddb202664d0a334bd3a89587eade19790261ce9b103fdf0d7db0c5c34ad2c` | `beta_construct` / 539 / 4 | 1050×255 / 18,144 | `43a24b85232ef9ad10f96f5caa0057d4f80c61c70cf1e67bd9d88bc1c9fc987d` |

Both clean-task outputs passed `PIL.Image.verify()` and `sha256sum`. Alpha is durably packaged and locally smoke-tested. Local macOS ARM64 alpha output is 865×255, 12,045 bytes, SHA-256 `04d24eced6f94ec6b39776e675baa8233496948f1e92b0d699cf3a95ec039602`; PNG bytes differ from Brainbase output due to platform rendering. Beta is historical Brainbase evidence only: canonical input bytes were not durably exported. Do not reconstruct beta; exclude corrupt 511 bp local copy.

Artifact and reproduction instructions: `person1/build/dna-feature-map/HANDOFF.md`. Downstream contract: `docs/person2-contract.md`.

## Docker, Lazarus, and provider boundaries

- Daytona Resurrection environment had no Docker CLI. E2B agent/task `2e40480d-ad3e-4c05-b731-12f0bb6e42f5` / `0f36b819-bf93-5c31-b6c6-f2744a09a455` installed Lazarus `0.5.0`; registry access and image pull succeeded, but the actual wrapper failed with `FileNotFoundError: docker`. Cloudflare diagnostic `c17afe7f-3a0c-4065-9bf3-78412de7e313` / `e2a4f08a-174c-5522-a629-0075e4b8857a` also had no Docker.
- BBSandbox and Modal agent creation were denied with HTTP 403. AWS microVM creation returned HTTP 503 twice. These are observed failures, not evidence those providers are unsupported.
- No Lazarus container or image was executed. Registry mapping `dnafeaturesviewer_genbank_plot` is MIT, GPU false, image `ghcr.io/doctordean/lazarus-dnafeaturesviewer:genbank-plot-ready`; it accepts GenBank→PNG, not this artifact's SeqRecord JSON. Do not claim this mapping ran or matches the verified input contract.
- No external MCP endpoint was configured. These probes do not show that every Brainbase provider was impossible.
- Supplied Dockerfile remains unbuilt. No production deployment or service endpoint was verified.

## A/B/C status

- **A — verified direct Python recovery:** actual Python JSON→PNG executions in clean Resurrection task; READY evaluation passed.
- **B — known Lazarus-compatible mapping, unexecuted:** registry entry identified, but Docker/runtime unavailable in observed environments and GenBank input mismatches JSON contract.
- **C — durable Python artifact:** package includes renderer, requirements, Dockerfile, verification script, handoff, canonical alpha fixture and local alpha PNG. Alpha local smoke passed; beta is historical only. Dockerfile build remains unverified.