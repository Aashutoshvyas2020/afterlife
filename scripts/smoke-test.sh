#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${WORKER_URL:-${1:-}}"
[[ "$BASE_URL" == https://* || "$BASE_URL" == http://localhost:* ]] || { printf 'Usage: scripts/smoke-test.sh https://<worker> [fixture.json] (optional: SMOKE_COOKIE_FILE=/path/to/paid-cookie.jar)\n' >&2; exit 2; }
BASE_URL="${BASE_URL%/}"
command -v jq >/dev/null || { printf 'smoke: jq required\n' >&2; exit 1; }
request() { curl --fail --silent --show-error --max-time 30 "$@"; }
printf 'Checking %s\n' "$BASE_URL"
health="$(request "$BASE_URL/health")"
jq -e '.status == "live"' <<<"$health" >/dev/null || { printf 'smoke: Worker health check failed\n' >&2; exit 1; }
status="$(request "$BASE_URL/api/status")"
jq -e '.deployment.status == "live" and .stripe.status == "ready" and .stripe.mode == "test"' <<<"$status" >/dev/null || { printf 'smoke: Worker deployment or test billing check failed\n' >&2; exit 1; }
artifact_status="$(jq -r '.artifact.status // "unknown"' <<<"$status")"
case "$artifact_status" in
  pending)
    artifact_error="$(jq -r '.artifact.error // "No recovered artifact configured"' <<<"$status")"
    printf 'smoke: prerequisite missing — recovered artifact is not configured (%s)\n' "$artifact_error" >&2
    exit 2
    ;;
  failed)
    artifact_error="$(jq -r '.artifact.error // "artifact health check failed"' <<<"$status")"
    printf 'smoke: recovered artifact service failed its health check (%s)\n' "$artifact_error" >&2
    exit 1
    ;;
  ready) ;;
  *)
    printf 'smoke: unexpected artifact status: %s\n' "$artifact_status" >&2
    exit 1
    ;;
esac
code="$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 10 "$BASE_URL/api/checkout")"
[[ "$code" == 404 || "$code" == 405 ]] || { printf 'smoke: GET checkout must not create a session (HTTP %s)\n' "$code" >&2; exit 1; }
code="$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 10 -H 'content-type: application/json' -d '{"input":{}}' "$BASE_URL/api/product/run")"
[[ "$code" == 403 ]] || { printf 'smoke: unauthenticated run expected 403 (HTTP %s)\n' "$code" >&2; exit 1; }
printf 'Unpaid-path smoke checks PASS (paid capability not exercised)\n'
FIXTURE="${CAPABILITY_FIXTURE:-${2:-person1/build/dna-feature-map/verification/input_alpha.json}}"
[[ -f "$FIXTURE" && -n "${SMOKE_COOKIE_FILE:-}" && -f "$SMOKE_COOKIE_FILE" ]] || { printf 'smoke: fixture and SMOKE_COOKIE_FILE paid browser cookie jar required for authenticated run\n' >&2; exit 1; }
jq -e 'type == "object" and has("input")' "$FIXTURE" >/dev/null || { printf 'smoke: fixture must be an object containing input\n' >&2; exit 1; }
payload="$(jq -cn --slurpfile fixture "$FIXTURE" '{input: $fixture[0]}')" || { printf 'smoke: could not build capability payload\n' >&2; exit 1; }
response="$(request --cookie "$SMOKE_COOKIE_FILE" -H 'content-type: application/json' --data-binary "$payload" "$BASE_URL/api/product/run")" || { printf 'smoke: authenticated capability request failed\n' >&2; exit 1; }
jq -e '.success == true and .result.recordId == "alpha_construct" and .result.sequenceLength == 488 and .result.featureCount == 3 and .result.mimeType == "image/png" and (.result.sha256 | type == "string" and test("^[0-9a-fA-F]{64}$")) and (.result.imageBase64 | type == "string" and length > 0)' <<<"$response" >/dev/null || { printf 'smoke: capability response metadata validation failed\n' >&2; exit 1; }
image_base64="$(jq -er '.result.imageBase64 | select(type == "string" and length > 0)' <<<"$response")" || { printf 'smoke: missing capability PNG image\n' >&2; exit 1; }
png_info="$(printf '%s' "$image_base64" | base64 --decode 2>/dev/null | od -An -tu1 -N24)" || { printf 'smoke: capability image is not valid base64 PNG data\n' >&2; exit 1; }
read -r -a png_bytes <<<"$png_info"
[[ "${#png_bytes[@]}" -eq 24 && "${png_bytes[0]}" -eq 137 && "${png_bytes[1]}" -eq 80 && "${png_bytes[2]}" -eq 78 && "${png_bytes[3]}" -eq 71 && "${png_bytes[4]}" -eq 13 && "${png_bytes[5]}" -eq 10 && "${png_bytes[6]}" -eq 26 && "${png_bytes[7]}" -eq 10 && "${png_bytes[12]}" -eq 73 && "${png_bytes[13]}" -eq 72 && "${png_bytes[14]}" -eq 68 && "${png_bytes[15]}" -eq 82 ]] || { printf 'smoke: capability image PNG signature/IHDR validation failed\n' >&2; exit 1; }
width=$(( png_bytes[16] * 16777216 + png_bytes[17] * 65536 + png_bytes[18] * 256 + png_bytes[19] ))
height=$(( png_bytes[20] * 16777216 + png_bytes[21] * 65536 + png_bytes[22] * 256 + png_bytes[23] ))
[[ "$width" -gt 0 && "$height" -gt 0 ]] || { printf 'smoke: capability PNG dimensions must be nonzero\n' >&2; exit 1; }
printf 'Paid capability execution PASS (PNG %sx%s); full smoke PASS\n' "$width" "$height"
