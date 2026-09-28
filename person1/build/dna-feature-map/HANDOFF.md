# DNA feature-map renderer handoff

Status: the SeqRecord renderer passed two real executions in clean Brainbase task `61dcece3-6760-46d6-bf0c-3d45b94b6e24`. Dockerfile is supplied but unbuilt.

## Provenance

- Upstream: [Edinburgh Genome Foundry / DnaFeaturesViewer](https://github.com/Edinburgh-Genome-Foundry/DnaFeaturesViewer)
- Source revision: `049bbe4e3063e90ae9b0f88ac7e92f47b735d38a`
- Upstream license: MIT (verified for this revision).
- Adapter copied from clean Brainbase task. SHA-256: `bad288c93d1aaaabe0c23ddf775b8b7d7c140714e33abf34827c0318ea656373`.
- Exact fixture SHA-256: alpha `179519ac5b239a8b8d1b54e784157287b1ee9317fba904ef31e239f0478a1ca9`; beta `6caddb202664d0a334bd3a89587eade19790261ce9b103fdf0d7db0c5c34ad2c`.

## Contract

Each UTF-8 JSON input requires `id`, `name`, `sequence`, and `features`. `sequence` is DNA text. Each feature has integer `start`, `end`, `strand`, and string `type`, `label`; `color` is optional. Coordinates follow Biopython `SimpleLocation` conventions (0-based, end-exclusive). Optional `figure_width` defaults to 10. The runner constructs a Biopython `SeqRecord`, translates features with `BiopythonTranslator`, and writes a PNG.

Invocation:

```sh
python run_seqrecord_plot.py INPUT.json OUTPUT.png
```

Stdout JSON reports `record_id`, `sequence_length`, `feature_count`, resolved output path, PNG byte count, and SHA-256.

## Reproduction

From repository root:

```sh
python3 -m pip install -r person1/build/dna-feature-map/requirements.txt
python3 person1/build/dna-feature-map/verify.py
```

Build and run container (not yet verified):

```sh
docker build -t afterlife-dna-feature-map person1/build/dna-feature-map
docker run --rm -v "$PWD/person1/build/dna-feature-map/verification:/data:ro" \
  -v "$PWD:/out" afterlife-dna-feature-map \
  /data/input_alpha.json /out/alpha.png
```

Required environment variables: none. Runner sets a Matplotlib cache default itself.

## Brainbase verification

Actual commands used:

```sh
.venv/bin/python run_seqrecord_plot.py verification/input_alpha.json verification/output_alpha.png
.venv/bin/python run_seqrecord_plot.py verification/input_beta.json verification/output_beta.png
```

Both exited 0; PNGs passed `PIL.Image.verify()` and `sha256sum`.

| Input | Sequence | Features | PNG dimensions | Bytes | SHA-256 |
|---|---:|---:|---:|---:|---|
| `input_alpha.json` | 488 bp | 3 | 865 × 255 | 13,400 | `ebfb506f713ebfedda7fc70fdaad31e2c168a70f95a351c6248f0d288617d0d1` |
| `input_beta.json` | 539 bp | 4 | 1,050 × 255 | 18,144 | `43a24b85232ef9ad10f96f5caa0057d4f80c61c70cf1e67bd9d88bc1c9fc987d` |

Local Python smoke: isolated macOS ARM64 Python 3.14 environment installed requirements and passed packaged alpha fixture. Local PNG `verification/output_alpha.png`: 865 × 255, 12,045 bytes, SHA-256 `04d24eced6f94ec6b39776e675baa8233496948f1e92b0d699cf3a95ec039602`. Cross-platform PNG bytes differ from Brainbase output.
Only canonical `input_alpha.json` is packaged; its SHA-256 matches clean-task source. Clean task also rendered canonical beta input successfully (539 bp, 4 features; output SHA-256 `43a24b85232ef9ad10f96f5caa0057d4f80c61c70cf1e67bd9d88bc1c9fc987d`). Beta JSON export was unavailable from task transcript, so it is recorded as execution evidence, not packaged as a fixture.

## Runtime limits

- Brainbase task had no Docker CLI (`command -v docker` returned no path); Dockerfile was not built or exercised. Do not describe image as tested/deployable.
- Lazarus registry entry `dnafeaturesviewer_genbank_plot` accepts a GenBank `.gb` file, not this programmatic SeqRecord JSON contract. Registry image was not run; this handoff does not claim Lazarus use.
- No public deployment is claimed.
