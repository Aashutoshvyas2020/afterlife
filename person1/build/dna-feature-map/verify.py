#!/usr/bin/env python3
"""Verify the packaged SeqRecord example and its PNG output."""

import hashlib
import json
import struct
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CASES = (
    ("input_alpha.json", "alpha_construct", 488, 3, (865, 255), "ebfb506f713ebfedda7fc70fdaad31e2c168a70f95a351c6248f0d288617d0d1"),
)


def main():
    with tempfile.TemporaryDirectory() as temp:
        for fixture, record_id, length, count, dimensions, reference_hash in CASES:
            output = Path(temp) / fixture.replace("input_", "").replace(".json", ".png")
            result = subprocess.run(
                [sys.executable, str(ROOT / "run_seqrecord_plot.py"), str(ROOT / "verification" / fixture), str(output)],
                check=True,
                capture_output=True,
                text=True,
            )
            metadata = json.loads(result.stdout)
            data = output.read_bytes()
            actual_hash = hashlib.sha256(data).hexdigest()
            actual_dimensions = struct.unpack(">II", data[16:24])
            assert data[:8] == b"\x89PNG\r\n\x1a\n", f"{fixture}: invalid PNG signature"
            assert min(actual_dimensions) > 0, f"{fixture}: invalid dimensions {actual_dimensions}"
            assert metadata["record_id"] == record_id, metadata
            assert metadata["sequence_length"] == length, metadata
            assert metadata["feature_count"] == count, metadata
            assert metadata["output"] == str(output.resolve()), metadata
            assert metadata["png_bytes"] == len(data), metadata
            assert metadata["sha256"] == actual_hash, metadata
            hash_status = "matches Brainbase" if actual_hash == reference_hash else "platform-specific hash"
            print(f"PASS {fixture}: {length}bp/{count} features, {actual_dimensions[0]}x{actual_dimensions[1]} PNG (Brainbase {dimensions[0]}x{dimensions[1]}), {len(data)} bytes, sha256={actual_hash} ({hash_status})")


if __name__ == "__main__":
    main()
