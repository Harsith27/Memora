#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/memora-frontend"
ALIAS_URL="${1:-memyapp.vercel.app}"
BACKEND_HEALTH_URL="${2:-https://memora-api-04021453.azurewebsites.net/api/health}"
DEPLOY_TARGET="${3:-preview}"

log() {
  echo "[frontend] $*"
}

fail() {
  echo "[frontend] ERROR: $*" >&2
  exit 1
}

require_command() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    fail "Required command not found: $cmd"
  fi
}

extract_deployment_url() {
  local output="$1"
  echo "$output" | grep -Eo 'https://[^ ]+\.vercel\.app' | tail -n1
}

verify_url_200() {
  local url="$1"
  local label="$2"
  local status_code
  status_code="$(curl -sS --max-time 15 --retry 15 --retry-delay 4 --retry-connrefused -o /dev/null -w "%{http_code}" "$url" || true)"
  if [[ "$status_code" != "200" ]]; then
    fail "$label check failed for $url (status=$status_code)"
  fi
  log "$label check passed: $url"
}

require_command vercel
require_command curl

cd "$FRONTEND_DIR"

log "Pulling production environment"
vercel pull --yes --environment=production

if [[ "$DEPLOY_TARGET" == "production" ]]; then
  fail "Production target is disabled in this script to protect the legacy URL."
fi

log "Deploying latest build as preview deployment"
set +e
DEPLOYMENT_OUTPUT="$(vercel deploy --yes 2>&1 | tr -d '\r')"
DEPLOY_EXIT_CODE=$?
set -e

DEPLOYMENT_URL="$(extract_deployment_url "$DEPLOYMENT_OUTPUT")"

if (( DEPLOY_EXIT_CODE != 0 )); then
  log "Vercel deploy returned non-zero exit ($DEPLOY_EXIT_CODE)."
  if [[ -z "$DEPLOYMENT_URL" ]]; then
    echo "$DEPLOYMENT_OUTPUT"
    fail "Frontend deployment failed and no deployment URL was reported"
  fi
  log "Continuing because deployment URL was still reported by Vercel."
fi

if [[ -z "$DEPLOYMENT_URL" ]]; then
  echo "$DEPLOYMENT_OUTPUT"
  fail "Failed to resolve deployment URL from Vercel output"
fi

echo "$DEPLOYMENT_OUTPUT"

log "Assigning alias $ALIAS_URL -> $DEPLOYMENT_URL"
set +e
ALIAS_OUTPUT="$(vercel alias set "$DEPLOYMENT_URL" "$ALIAS_URL" 2>&1 | tr -d '\r')"
ALIAS_EXIT_CODE=$?
set -e
echo "$ALIAS_OUTPUT"

if (( ALIAS_EXIT_CODE != 0 )); then
  log "Alias assignment exited non-zero ($ALIAS_EXIT_CODE); continuing with health verification."
fi

verify_url_200 "$DEPLOYMENT_URL" "Frontend deployment root"
verify_url_200 "$DEPLOYMENT_URL/api/health" "Frontend deployment rewrite API"

verify_url_200 "https://$ALIAS_URL" "Frontend root"
verify_url_200 "https://$ALIAS_URL/api/health" "Frontend rewrite API"
verify_url_200 "$BACKEND_HEALTH_URL" "Backend health"

log "Done: $DEPLOYMENT_URL"
