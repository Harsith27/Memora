#!/usr/bin/env bash
set -euo pipefail

FRONTEND_URL="${1:-https://memoraapp-next.vercel.app}"
BACKEND_URL="${2:-https://memora-api-04021453.azurewebsites.net}"

log() {
  echo "[smoke] $*"
}

fail() {
  echo "[smoke] ERROR: $*" >&2
  exit 1
}

require_command() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    fail "Required command not found: $cmd"
  fi
}

check_200() {
  local url="$1"
  local label="$2"
  local body_file
  body_file="$(mktemp)"
  trap 'rm -f "$body_file"' RETURN

  local code
  code="$(curl -sS --max-time 15 --retry 8 --retry-delay 3 --retry-connrefused -o "$body_file" -w "%{http_code}" "$url" || true)"

  if [[ "$code" != "200" ]]; then
    log "$label response body:"
    cat "$body_file" || true
    fail "$label failed for $url (status=$code)"
  fi

  log "$label passed ($code): $url"
}

require_command curl

check_200 "$FRONTEND_URL" "Frontend root"
check_200 "$BACKEND_URL/api/health" "Backend health"
check_200 "$FRONTEND_URL/api/health" "Frontend rewrite health"

log "All production smoke checks passed"
