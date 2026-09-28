# Person 2 capability contract

## Verified handoff

Clean Brainbase orchestration **Afterlife Person 1** run: Scout root `a812f306-4e6d-5572-8b64-f04aecb0800b` (success); native Investment child `8aced9ad-5ce6-427f-9504-5d3c035e3487` via edge `65dbb1e2-aa0c-4f1f-984e-205e9300a237` (success, **FUND**); native Resurrection child `61dcece3-6760-46d6-bf0c-3d45b94b6e24` via edge `62d9beb2-bece-4ac3-b750-bf3482a268ce` (success, **READY**). Investment ran autonomously; no human/manual follow-up. Both Investment and Resurrection evaluations passed. Funded source: DnaFeaturesViewer, MIT, revision `049bbe4e3063e90ae9b0f88ac7e92f47b735d38a`.

`FUND` means selected capability proceeds to native Resurrection; `PASS_ALL` means no candidate funded and flow stops. Neither decision means deployment or paid product readiness.

## Capability: JSON SeqRecord → PNG

This is a local CLI, not an HTTP service. Each UTF-8 input object follows the real runner's schema:

```json
{
  "id": "alpha_construct",
  "name": "Alpha plasmid map",
  "sequence": "ATGCGT...",
  "figure_width": 9,
  "features": [
    {"start": 15, "end": 95, "strand": 1, "type": "promoter", "label": "P_alpha", "color": "#ffd166"}
  ]
}
```

Required top-level fields: `id` (string), `name` (string), `sequence` (DNA string), `features` (array). Each feature requires integer `start`, integer `end`, `strand` (fixture values `1` or `-1`), string `type`, and string `label`; `color` is optional string. `figure_width` is optional number (default `10`). Coordinates use Biopython `SimpleLocation`: zero-based, end-exclusive. Runner constructs a `SeqRecord`, translates its features, and writes PNG.

Run from the renderer directory (same invocation used in clean task):

```sh
.venv/bin/python run_seqrecord_plot.py verification/input_alpha.json verification/output_alpha.png
.venv/bin/python run_seqrecord_plot.py verification/input_beta.json verification/output_beta.png
```

Outputs are files with `image/png` content. Stdout emits one JSON object with `record_id`, `sequence_length`, `feature_count`, resolved `output` path, `png_bytes`, and output `sha256`. The verified clean-task results:

| Fixture | Input SHA-256 | Record / bp / features | PNG dimensions / bytes | Output SHA-256 |
|---|---|---|---|---|
| alpha | `179519ac5b239a8b8d1b54e784157287b1ee9317fba904ef31e239f0478a1ca9` | `alpha_construct` / 488 / 3 | 865×255 / 13,400 | `ebfb506f713ebfedda7fc70fdaad31e2c168a70f95a351c6248f0d288617d0d1` |
| beta | `6caddb202664d0a334bd3a89587eade19790261ce9b103fdf0d7db0c5c34ad2c` | `beta_construct` / 539 / 4 | 1050×255 / 18,144 | `43a24b85232ef9ad10f96f5caa0057d4f80c61c70cf1e67bd9d88bc1c9fc987d` |

Both outputs passed `PIL.Image.verify()` and SHA-256 checks in the clean run. Dimensions/output hashes describe that run; do not assume byte-identical rendering across environments. Canonical beta bytes were not durably exported. The local beta file has SHA-256 `7e3952aebb909c8f1a1d3d2b483ac1039d128b7156035f97b28ab88124103507`, not canonical `6caddb202664d0a334bd3a89587eade19790261ce9b103fdf0d7db0c5c34ad2c`; exclude it and do not reconstruct it. Beta remains historical Brainbase run evidence only.

## Brainbase status and evidence

Use native task operations to inspect task status/evaluations and task transcript; these are not a custom normalized event API:

```sh
brainbase task get a812f306-4e6d-5572-8b64-f04aecb0800b --json
brainbase task get 8aced9ad-5ce6-427f-9504-5d3c035e3487 --json
brainbase task get 61dcece3-6760-46d6-bf0c-3d45b94b6e24 --json
brainbase task logs 61dcece3-6760-46d6-bf0c-3d45b94b6e24 --follow
```

`get` reports task status and evaluation verdicts; `logs` prints transcript events, and `--follow` tails new events until task ends. Read native records/transcript as-is; do not assume a stable app-level event shape, artifact download URL, or `/api/run` endpoint.

## Limits

No production deployment, public capability endpoint, or Lazarus image execution was verified. Brainbase environment lacked Docker CLI; supplied Dockerfile was not built. This contract exposes the verified CLI artifact only; it does not claim a service API, UI, billing, or deployed product.
