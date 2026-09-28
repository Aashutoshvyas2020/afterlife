#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
command -v npx >/dev/null 2>&1 || { printf 'deploy-dummy: npx is required\n' >&2; exit 1; }
npx wrangler deploy --config wrangler.dummy.jsonc
if [[ -n "${DUMMY_WORKER_URL:-}" ]]; then
  printf 'Checking dummy health endpoint: %s/health\n' "${DUMMY_WORKER_URL%/}"
  curl --fail --silent --show-error "${DUMMY_WORKER_URL%/}/health"
  printf '\n'
else
  printf 'Dummy deployment complete. Set DUMMY_WORKER_URL to check /health.\n'
fi
