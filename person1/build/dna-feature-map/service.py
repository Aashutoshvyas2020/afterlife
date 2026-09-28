#!/usr/bin/env python3
"""Small HTTP adapter for the verified CLI. No synthetic results."""
import base64
import hmac
import json
import os
import subprocess
import sys
import tempfile
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MAX_BYTES = 32768


def validate(spec):
    if not isinstance(spec, dict):
        raise ValueError("Expected a DNA feature-map JSON object")
    for key in ("id", "name", "sequence"):
        if not isinstance(spec.get(key), str) or not spec[key].strip():
            raise ValueError(f"{key} must be a non-empty string")
    if len(spec["id"]) > 100 or len(spec["name"]) > 100:
        raise ValueError("id and name must be at most 100 characters")
    sequence = spec["sequence"]
    if len(sequence) > 20000 or any(c.upper() not in "ACGTRYSWKMBDHVN" for c in sequence):
        raise ValueError("sequence must contain 1–20000 DNA bases (IUPAC letters)")
    features = spec.get("features")
    if not isinstance(features, list) or len(features) > 100:
        raise ValueError("features must be an array of at most 100 annotations")
    width = spec.get("figure_width", 10)
    if type(width) not in (int, float) or not 3 <= width <= 16:
        raise ValueError("figure_width must be between 3 and 16")
    for f in features:
        if not isinstance(f, dict):
            raise ValueError("Each feature must be an object")
        if type(f.get("start")) is not int or type(f.get("end")) is not int or not 0 <= f["start"] < f["end"] <= len(sequence):
            raise ValueError("Feature coordinates must satisfy 0 <= start < end <= sequence length")
        if type(f.get("strand")) is not int or f["strand"] not in (-1, 1):
            raise ValueError("Feature strand must be -1 or 1")
        for key in ("label", "type"):
            if not isinstance(f.get(key), str) or not 1 <= len(f[key]) <= 100:
                raise ValueError(f"Feature {key} must contain 1–100 characters")
        if "color" in f:
            from matplotlib.colors import is_color_like
            if not isinstance(f["color"], str) or not is_color_like(f["color"]):
                raise ValueError("Feature color must be a valid plotting color")


def render(spec):
    validate(spec)
    with tempfile.TemporaryDirectory(prefix="afterlife-map-") as folder:
        source, output = Path(folder) / "input.json", Path(folder) / "output.png"
        source.write_text(json.dumps(spec))
        result = subprocess.run([sys.executable, str(ROOT / "run_seqrecord_plot.py"), str(source), str(output)],
                                capture_output=True, text=True, check=True, timeout=15)
        metadata = json.loads(result.stdout)
        metadata.pop("output", None)  # Do not expose the temporary server path.
        return {"mime_type": "image/png", "image_base64": base64.b64encode(output.read_bytes()).decode(), **metadata}


class Handler(BaseHTTPRequestHandler):
    def respond(self, status, value):
        data = json.dumps(value).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def authorized(self):
        token = os.environ.get("CAPABILITY_TOKEN")
        return not token or hmac.compare_digest(self.headers.get("Authorization", ""), f"Bearer {token}")

    def do_GET(self):
        if not self.authorized():
            return self.respond(401, {"error": "Unauthorized"})
        if self.path != "/health":
            return self.respond(404, {"error": "Not found"})
        self.respond(200, {"status": "ready", "capability": "dna-feature-map"})

    def do_POST(self):
        if not self.authorized():
            return self.respond(401, {"error": "Unauthorized"})
        if self.path != "/run":
            return self.respond(404, {"error": "Not found"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= MAX_BYTES:
                return self.respond(413, {"error": "Expected a JSON body of at most 32 KB"})
            spec = json.loads(self.rfile.read(length))
            self.respond(200, render(spec))
        except (ValueError, UnicodeDecodeError) as error:
            self.respond(400, {"error": str(error)})
        except subprocess.TimeoutExpired:
            self.respond(504, {"error": "Rendering timed out"})
        except Exception:
            self.respond(500, {"error": "Could not render this feature map"})


if __name__ == "__main__":
    # Fail at startup if the actual recovered software is missing.
    import run_seqrecord_plot  # noqa: F401
    host, port = os.environ.get("HOST", "127.0.0.1"), int(os.environ.get("PORT", "8090"))
    if host not in ("127.0.0.1", "localhost", "::1") and not os.environ.get("CAPABILITY_TOKEN"):
        raise SystemExit("Set CAPABILITY_TOKEN before exposing the renderer on a network interface")
    print(f"DNA feature-map service listening on {host}:{port}", flush=True)
    HTTPServer((host, port), Handler).serve_forever()
