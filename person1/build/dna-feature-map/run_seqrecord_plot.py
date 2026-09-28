#!/usr/bin/env python3
"""Render a programmatically constructed Biopython SeqRecord feature map."""

import argparse
import hashlib
import json
import os
from pathlib import Path

os.environ.setdefault("MPLCONFIGDIR", "/tmp/dnafeaturesviewer-matplotlib")
import matplotlib

matplotlib.use("Agg")
from Bio.Seq import Seq
from Bio.SeqFeature import SeqFeature, SimpleLocation
from Bio.SeqRecord import SeqRecord
from dna_features_viewer import BiopythonTranslator


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input_json", type=Path)
    parser.add_argument("output_png", type=Path)
    args = parser.parse_args()
    spec = json.loads(args.input_json.read_text())

    record = SeqRecord(Seq(spec["sequence"]), id=spec["id"], name=spec["name"])
    record.features = [
        SeqFeature(
            SimpleLocation(feature["start"], feature["end"], strand=feature["strand"]),
            type=feature["type"],
            qualifiers={
                "label": [feature["label"]],
                **({"color": [feature["color"]]} if "color" in feature else {}),
            },
        )
        for feature in spec["features"]
    ]

    graphic_record = BiopythonTranslator().translate_record(record)
    axis, _ = graphic_record.plot(figure_width=spec.get("figure_width", 10))
    args.output_png.parent.mkdir(parents=True, exist_ok=True)
    axis.figure.savefig(args.output_png, format="png", bbox_inches="tight", dpi=120)
    png = args.output_png.read_bytes()
    if not png.startswith(b"\x89PNG\r\n\x1a\n"):
        raise RuntimeError("output does not have the PNG signature")
    print(json.dumps({
        "record_id": record.id,
        "sequence_length": len(record.seq),
        "feature_count": len(record.features),
        "output": str(args.output_png.resolve()),
        "png_bytes": len(png),
        "sha256": hashlib.sha256(png).hexdigest(),
    }, sort_keys=True))


if __name__ == "__main__":
    main()
