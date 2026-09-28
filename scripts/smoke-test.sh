#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${WORKER_URL:-${1:-}}"
[[ "$BASE_URL" == https://* || "$BASE_URL" == http://localhost:* ]] || { printf 'Usage: scripts/smoke-test.sh https://<worker> [fixture.json] (optional: SMOKE_COOKIE_FILE=/path/to/paid-cookie.jar)\n' >&2; exit 2; }
BASE_URL="${BASE_URL%/}"
command -v jq >/dev/null || { printf 'smoke: jq required\n' >&2; exit 1; }
request() { curl --fail --silent --show-error --max-time 30 "$@"; }
printf 'Checking %s\n' "$BASE_URL"
request "$BASE_URL/health" | jq -e '.status == "live" and .artifact.status == "ready"' >/dev/null
request "$BASE_URL/api/status" | jq -e '.deployment.status == "live" and .artifact.status == "ready" and .stripe.status == "ready" and .stripe.mode == "test"' >/dev/null
code="$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 10 "$BASE_URL/api/checkout")"
[[ "$code" == 404 || "$code" == 405 ]] || { printf 'smoke: GET checkout must not create a session (HTTP %s)\n' "$code" >&2; exit 1; }
code="$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 10 -H 'content-type: application/json' -d '{"input":{}}' "$BASE_URL/api/product/run")"
[[ "$code" == 403 ]] || { printf 'smoke: unauthenticated run expected 403 (HTTP %s)\n' "$code" >&2; exit 1; }
printf 'Health, artifact, test billing, and unpaid access PASS\n'
FIXTURE="${CAPABILITY_FIXTURE:-${2:-}}"
if [[ -n "$FIXTURE" ]]; then
  [[ -f "$FIXTURE" && -n "${SMOKE_COOKIE_FILE:-}" && -f "$SMOKE_COOKIE_FILE" ]] || { printf 'smoke: fixture and SMOKE_COOKIE_FILE paid browser cookie jar required for authenticated run\n' >&2; exit 1; }
  jq -e 'type == "object" and has("input")' "$FIXTURE" >/dev/null
  request --cookie "$SMOKE_COOKIE_FILE" -H 'content-type: application/json' --data-binary "@$FIXTURE" "$BASE_URL/api/product/run" | jq -e '.success == true and has("result")' >/dev/null
  printf 'Authenticated recovered capability PASS\n'
else
  printf 'Authenticated capability NOT VERIFIED: supply fixture and SMOKE_COOKIE_FILE to check it.\n'
fi
