#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
CONFIG="wrangler.jsonc"

fail() { printf 'deploy: %s\n' "$1" >&2; exit 1; }

command -v npm >/dev/null 2>&1 || fail 'npm is required'
command -v npx >/dev/null 2>&1 || fail 'npx is required'
command -v curl >/dev/null 2>&1 || fail 'curl is required'
[[ -f "$CONFIG" ]] || fail "$CONFIG is missing"

DB_CONFIG="$(node --input-type=module -e 'import fs from "node:fs"; const s=fs.readFileSync(process.argv[1],"utf8"); const id=s.match(/"database_id"\s*:\s*"([^"]*)"/); const name=s.match(/"database_name"\s*:\s*"([^"]*)"/); process.stdout.write(JSON.stringify({id:id?.[1] ?? "",name:name?.[1] ?? ""}));' "$CONFIG")"
DB_ID="$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).id)' "$DB_CONFIG")"
DB_NAME="$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).name)' "$DB_CONFIG")"
[[ "$DB_ID" =~ ^[[:xdigit:]-]{36}$ && "$DB_ID" != REPLACE_* ]] || fail 'replace database_id in wrangler.jsonc with the production D1 database UUID'
[[ -n "$DB_NAME" && "$DB_NAME" != REPLACE_* ]] || fail 'configure database_name in wrangler.jsonc'
if [[ -n "${CLOUDFLARE_D1_DATABASE_ID:-}" && "$CLOUDFLARE_D1_DATABASE_ID" != "$DB_ID" ]]; then
  fail 'CLOUDFLARE_D1_DATABASE_ID does not match wrangler.jsonc database_id'
fi

PRICE_ID="$(node --input-type=module -e 'import fs from "node:fs"; const s=fs.readFileSync(process.argv[1],"utf8"); const m=s.match(/"STRIPE_PRICE_ID"\s*:\s*"([^"]*)"/); if(m) process.stdout.write(m[1]);' "$CONFIG")"
[[ "$PRICE_ID" == price_* && "$PRICE_ID" != *REPLACE* ]] || fail 'configure a real one-time Stripe price ID in wrangler.jsonc'
printf 'Wrangler secrets STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET must be configured; /api/status validates them after deployment.\n'
npm run build --if-present
npx wrangler d1 migrations apply DB --remote --config "$CONFIG"
npx wrangler deploy --config "$CONFIG"

DEPLOY_URL="${WORKER_URL:-}"
if [[ -n "$DEPLOY_URL" ]]; then
  printf 'Checking deployed health endpoint: %s/health\n' "${DEPLOY_URL%/}"
  curl --fail --silent --show-error "${DEPLOY_URL%/}/health"
  printf '\n'
  curl --fail --silent --show-error "${DEPLOY_URL%/}/api/status" |
    node --input-type=module -e 'let s=""; for await (const chunk of process.stdin) s+=chunk; const data=JSON.parse(s); if(data.stripe?.status!=="ready") { console.error("deploy: Stripe test-mode billing not ready:", data.stripe?.error||data.stripe?.status); process.exitCode=1 } else console.log("Stripe test price verified:",data.stripe.priceId)'
else
  printf 'Deployment complete. Set WORKER_URL to check /health and /api/status.\n'
fi
