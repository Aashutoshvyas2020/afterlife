#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${WORKER_URL:-${1:-}}"
[[ "$BASE_URL" == https://* || "$BASE_URL" == http://localhost:* || "$BASE_URL" == http://127.0.0.1:* ]] || { printf 'Usage: scripts/smoke-test.sh https://<worker> [fixture.json] (optional: SMOKE_COOKIE_FILE=/path/to/paid-cookie.jar)\n' >&2; exit 2; }
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
FIXTURE="${CAPABILITY_FIXTURE:-${2:-}}"
if [[ -n "$FIXTURE" ]]; then
  [[ -f "$FIXTURE" && -n "${SMOKE_COOKIE_FILE:-}" && -f "$SMOKE_COOKIE_FILE" ]] || { printf 'smoke: fixture and SMOKE_COOKIE_FILE paid browser cookie jar required for authenticated run\n' >&2; exit 1; }
  jq -e 'type == "object"' "$FIXTURE" >/dev/null
  jq 'if has("input") then . else {input: .} end' "$FIXTURE" |
    request --cookie "$SMOKE_COOKIE_FILE" -H 'content-type: application/json' --data-binary @- "$BASE_URL/api/product/run" |
    jq -e '.success == true and .result.mimeType == "image/png" and (.result.imageBase64 | startswith("iVBORw0KGgo"))' >/dev/null
  printf 'Paid capability execution PASS; full smoke PASS\n'
else
  printf 'SMOKE INCOMPLETE: paid capability NOT VERIFIED; supply fixture and SMOKE_COOKIE_FILE for a full PASS.\n'
  exit 2
fi
