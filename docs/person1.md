# Person 1: investment and resurrection

## Ownership

Person 1 owns candidate evidence, fund/pass decision, recovery orchestration, and a verified callable artifact with a stable handoff. Person 1 does not own customer UI, billing, or production deployment.

## Clean native run

Brainbase orchestration **Afterlife Person 1** completed successfully:

- Scout root task `a812f306-4e6d-5572-8b64-f04aecb0800b`.
- Investment child `8aced9ad-5ce6-427f-9504-5d3c035e3487`, launched through edge `65dbb1e2-aa0c-4f1f-984e-205e9300a237`; returned **FUND**.
- Resurrection child `61dcece3-6760-46d6-bf0c-3d45b94b6e24`, launched through edge `62d9beb2-bece-4ac3-b750-bf3482a268ce`; returned **READY**.
- Orchestration graph ID: `43440ca3-9869-4437-b5db-a42cce05a0da`. Investment and Resurrection evaluations passed.
- Investment invoked native `create_task_for_*` directly; no manual follow-up was needed. Scout's first handoff was rejected by Brainbase for missing required recommendation schema; Scout corrected its payload and retried automatically.

Funded source: DnaFeaturesViewer, MIT, source commit `049bbe4e3063e90ae9b0f88ac7e92f47b735d38a`. This establishes the clean native flow and verified local CLI artifact, not production readiness or deployment.

## Verified capability and artifact

The callable artifact accepts SeqRecord-shaped JSON and writes a feature-map PNG. It is not an HTTP service. The clean task ran:

```sh
.venv/bin/python run_seqrecord_plot.py verification/input_alpha.json verification/output_alpha.png
.venv/bin/python run_seqrecord_plot.py verification/input_beta.json verification/output_beta.png
```

| Evidence | Input SHA-256 | Output evidence |
|---|---|---|
| alpha, 488 bp / 3 features | `179519ac5b239a8b8d1b54e784157287b1ee9317fba904ef31e239f0478a1ca9` | PNG 865×255, 13,400 bytes; SHA-256 `ebfb506f713ebfedda7fc70fdaad31e2c168a70f95a351c6248f0d288617d0d1` |
| beta, 539 bp / 4 features | `6caddb202664d0a334bd3a89587eade19790261ce9b103fdf0d7db0c5c34ad2c` | PNG 1050×255, 18,144 bytes; SHA-256 `43a24b85232ef9ad10f96f5caa0057d4f80c61c70cf1e67bd9d88bc1c9fc987d` |

Both clean-task outputs passed `PIL.Image.verify()` and `sha256sum`. Alpha fixture is packaged and has a local smoke run; local macOS ARM64 PNG is 865×255, 12,045 bytes, SHA-256 `04d24eced6f94ec6b39776e675baa8233496948f1e92b0d699cf3a95ec039602`. It differs bytewise from Brainbase output due to platform rendering. Beta is historical Brainbase execution evidence only: exact canonical beta input bytes were not durably exported. Do not reconstruct beta or use the corrupt 511 bp local copy; exclude it.

The stable artifact and reproduction details are in `person1/build/dna-feature-map/HANDOFF.md`. `docs/person2-contract.md` records downstream interface and evidence.

## Runtime boundaries

- No Docker image was executed. Daytona Resurrection environment lacked Docker CLI. E2B installed Lazarus 0.5.0 and pulled registry metadata, but the actual wrapper failed with `FileNotFoundError: docker`; Cloudflare diagnostic environment also lacked Docker.
- BBSandbox and Modal agent creation returned HTTP 403. AWS microVM creation returned HTTP 503 twice. This is an observed infrastructure boundary, not proof those providers are unsupported.
- Lazarus registry entry `dnafeaturesviewer_genbank_plot` maps to `ghcr.io/doctordean/lazarus-dnafeaturesviewer:genbank-plot-ready`, MIT, GPU false, and accepts GenBank→PNG. It does not match this artifact's SeqRecord JSON input and was not run.
- No external MCP endpoint was configured. These checks do not establish that every Brainbase provider is unavailable.
- Artifact Dockerfile is supplied but unbuilt. No production deployment or Lazarus-container success is claimed.

## A/B/C status

- **A — verified direct Python recovery:** clean Brainbase Resurrection task ran actual Python JSON→PNG capability twice; READY evaluation passed.
- **B — known Lazarus-compatible mapping, unexecuted:** registry maps DnaFeaturesViewer GenBank→PNG image, but runtime was blocked and its GenBank input mismatches this artifact's SeqRecord JSON contract. Not a verified fallback.
- **C — durable Python artifact:** renderer, requirements, Dockerfile, verification script, handoff, canonical alpha fixture, and local alpha PNG are present under `person1/build/dna-feature-map`. Alpha local smoke passed; beta remains historical evidence only. Dockerfile build is unverified.