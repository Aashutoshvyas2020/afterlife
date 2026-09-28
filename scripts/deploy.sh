#!/usr/bin/env bash
set -euo pipefail
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"
npm run build
npx wrangler d1 migrations apply DB --remote
npx wrangler deploy
DEPLOY_URL="${WORKER_URL:-https://afterlife.afterlife-worker.workers.dev}"
node scripts/live-smoke.mjs "$DEPLOY_URL"
printf 'Production URL: %s\n' "$DEPLOY_URL"
