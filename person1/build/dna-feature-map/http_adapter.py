#!/usr/bin/env python3
"""HTTP adapter for the verified SeqRecord-to-PNG command-line renderer."""

import os
import base64
import hmac
import json
import subprocess
import sys
import tempfile
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import urlsplit

RENDERER = Path(__file__).with_name("run_seqrecord_plot.py")
MAX_INPUT_BYTES = 32 * 1024


class Handler(BaseHTTPRequestHandler):
    def send_json(self, status, value):
        payload = json.dumps(value, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json; charset=utf-8")
        self.send_header("cache-control", "no-store")
        self.send_header("content-length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def authorized(self):
        token = os.environ.get("CAPABILITY_AUTH_TOKEN")
        if not token:
            self.send_json(503, {"error": "Capability authentication is not configured"})
            return False
        if not hmac.compare_digest(self.headers.get("authorization", ""), f"Bearer {token}"):
            self.send_json(401, {"error": "Unauthorized"})
            return False
        return True

    def do_GET(self):
        if urlsplit(self.path).path == "/health":
            if not os.environ.get("CAPABILITY_AUTH_TOKEN"):
                self.send_json(503, {"status": "unconfigured"})
                return
            self.send_json(200, {"status": "healthy", "service": "dna-feature-map"})
            return
        self.send_json(404, {"error": "Not found"})

    def do_POST(self):
        if urlsplit(self.path).path != "/run":
            self.send_json(404, {"error": "Not found"})
            return
        if not self.authorized():
            return
        try:
            length = int(self.headers.get("content-length", "-1"))
        except ValueError:
            self.send_json(400, {"error": "Invalid content length"})
            return
        if length < 0 or length > MAX_INPUT_BYTES:
            self.send_json(413 if length > MAX_INPUT_BYTES else 400, {"error": "Input must be at most 32768 bytes"})
            return
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            if not isinstance(payload, dict):
                raise ValueError("Expected a JSON object")
        except (UnicodeDecodeError, json.JSONDecodeError, ValueError):
            self.send_json(400, {"error": "Expected a SeqRecord JSON object"})
            return

        try:
            with tempfile.TemporaryDirectory(prefix="dna-feature-map-") as directory:
                input_path = Path(directory) / "input.json"
                output_path = Path(directory) / "output.png"
                input_path.write_text(json.dumps(payload), encoding="utf-8")
                completed = subprocess.run(
                    [sys.executable, str(RENDERER), str(input_path), str(output_path)],
                    check=True,
                    capture_output=True,
                    text=True,
                    timeout=60,
                )
                metadata = json.loads(completed.stdout)
                image = output_path.read_bytes()
        except subprocess.CalledProcessError:
            self.send_json(422, {"error": "The renderer rejected this SeqRecord input"})
            return
        except subprocess.TimeoutExpired:
            self.send_json(504, {"error": "The renderer timed out"})
            return
        except (OSError, json.JSONDecodeError, KeyError, TypeError, ValueError):
            self.send_json(500, {"error": "The recovered renderer failed"})
            return

        self.send_json(200, {
            "recordId": metadata["record_id"],
            "sequenceLength": metadata["sequence_length"],
            "featureCount": metadata["feature_count"],
            "mimeType": "image/png",
            "imageBase64": base64.b64encode(image).decode("ascii"),
            "sha256": metadata["sha256"],
        })

    def log_message(self, _format, *_args):
        return


def main():
    port = int(os.environ.get("PORT", "8080"))
    HTTPServer(("0.0.0.0", port), Handler).serve_forever()


if __name__ == "__main__":
    main()
