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
npm run build
npx wrangler d1 migrations apply DB --remote --config "$CONFIG"
npx wrangler deploy --config "$CONFIG"

DEPLOY_URL="${WORKER_URL:-$(node --input-type=module -e 'import fs from "node:fs"; const config=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(config.vars?.PUBLIC_URL || "")' "$CONFIG")}"
[[ "$DEPLOY_URL" == https://* ]] || fail 'set PUBLIC_URL in wrangler.jsonc or WORKER_URL to the deployed HTTPS URL'
printf 'Checking deployed health endpoint: %s/health\n' "${DEPLOY_URL%/}"
curl --fail --silent --show-error --retry 3 --retry-delay 2 "${DEPLOY_URL%/}/health" |
  node --input-type=module -e 'let s=""; for await (const chunk of process.stdin) s+=chunk; const health=JSON.parse(s); if(health.status!=="live") { console.error("deploy: Worker health is not live"); process.exitCode=1 } else console.log("Worker live; artifact:", health.artifact?.status || "unknown")'
curl --fail --silent --show-error "${DEPLOY_URL%/}/api/status" |
  node --input-type=module -e 'let s=""; for await (const chunk of process.stdin) s+=chunk; const data=JSON.parse(s); if(data.stripe?.status!=="ready" || data.stripe?.mode!=="test") { console.error("deploy: Stripe test billing not ready:", data.stripe?.error||data.stripe?.status); process.exitCode=1 } else console.log("Stripe test price verified:",data.stripe.priceId)'
printf 'Production URL: %s\n' "$DEPLOY_URL"
