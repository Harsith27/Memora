#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/memora-backend"
RESOURCE_GROUP="${1:-memora-prod-rg}"
APP_NAME="${2:-memora-api-04021453}"
ARTIFACT_PATH="$ROOT_DIR/backend-deploy-selfcontained.zip"
CURRENT_ARTIFACT_PATH="$ROOT_DIR/backend-deploy-current.zip"
HEALTH_URL="https://$APP_NAME.azurewebsites.net/api/health"

log() {
  echo "[backend] $*"
}

fail() {
  echo "[backend] ERROR: $*" >&2
  exit 1
}

require_command() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    fail "Required command not found: $cmd"
  fi
}

check_required_app_settings() {
  local required_settings=(
    NODE_ENV
    JWT_SECRET
    JWT_REFRESH_SECRET
    MONGODB_URI
    FRONTEND_URLS
  )
  local missing=()

  for setting in "${required_settings[@]}"; do
    local value
    value="$(az webapp config appsettings list -g "$RESOURCE_GROUP" -n "$APP_NAME" --query "[?name=='$setting'].value | [0]" -o tsv | tr -d '\r')"
    if [[ -z "$value" || "$value" == "null" || "$value" == "None" ]]; then
      missing+=("$setting")
    fi
  done

  if (( ${#missing[@]} > 0 )); then
    fail "Missing required Azure app settings: ${missing[*]}"
  fi
}

wait_for_healthy_backend() {
  local health_body
  health_body="$(mktemp)"
  trap 'rm -f "$health_body"' RETURN

  local status_code
  status_code="$(curl -sS --max-time 15 --retry 24 --retry-delay 5 --retry-connrefused -o "$health_body" -w "%{http_code}" "$HEALTH_URL" || true)"

  if [[ "$status_code" != "200" ]]; then
    log "Last health response body:"
    cat "$health_body" || true
    return 1
  fi

  log "Health endpoint returned 200"
  cat "$health_body"
  return 0
}

show_latest_deploy_summary() {
  local deploy_json
  deploy_json="$(az webapp log deployment list -g "$RESOURCE_GROUP" -n "$APP_NAME" --query "[0].{id:id,status:status,complete:complete,end_time:end_time,progress:progress}" -o json)"
  log "Latest deployment summary: $deploy_json"
}

require_command az
require_command python
require_command curl

[[ -f "$BACKEND_DIR/package.json" ]] || fail "Backend package.json not found at $BACKEND_DIR"

if ! az account show >/dev/null 2>&1; then
  fail "Azure CLI is not authenticated. Run: az login"
fi

if ! az webapp show -g "$RESOURCE_GROUP" -n "$APP_NAME" >/dev/null 2>&1; then
  fail "Azure Web App not found: $APP_NAME in resource group $RESOURCE_GROUP"
fi

log "Validating required Azure app settings"
check_required_app_settings

log "Ensuring startup command and build settings"
startup_cmd="$(az webapp config show -g "$RESOURCE_GROUP" -n "$APP_NAME" --query appCommandLine -o tsv | tr -d '\r')"
if [[ "$startup_cmd" != "npm start" ]]; then
  az webapp config set -g "$RESOURCE_GROUP" -n "$APP_NAME" --startup-file "npm start" >/dev/null
fi

az webapp config appsettings set \
  -g "$RESOURCE_GROUP" \
  -n "$APP_NAME" \
  --settings WEBSITE_RUN_FROM_PACKAGE=0 SCM_DO_BUILD_DURING_DEPLOYMENT=true ENABLE_ORYX_BUILD=true >/dev/null

log "Creating fresh deploy artifact: $ARTIFACT_PATH"
python - "$BACKEND_DIR" "$ARTIFACT_PATH" <<'PY'
import os
import sys
import zipfile

backend_dir = os.path.abspath(sys.argv[1])
artifact_path = os.path.abspath(sys.argv[2])

exclude_files = {'.env', 'nul'}
exclude_dirs = {'node_modules', '.git'}

if os.path.exists(artifact_path):
  os.remove(artifact_path)

with zipfile.ZipFile(artifact_path, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
  for base, dirs, files in os.walk(backend_dir):
    dirs[:] = [d for d in dirs if d not in exclude_dirs]
    for file_name in files:
      if file_name in exclude_files:
        continue
      absolute_path = os.path.join(base, file_name)
      relative_path = os.path.relpath(absolute_path, backend_dir).replace('\\', '/')
      zf.write(absolute_path, relative_path)

print(f"Packaged backend artifact at: {artifact_path}")
PY

cp -f "$ARTIFACT_PATH" "$CURRENT_ARTIFACT_PATH"
log "Synced artifact copy: $CURRENT_ARTIFACT_PATH"

log "Verifying artifact includes package.json"
python - "$ARTIFACT_PATH" <<'PY'
import os
import sys
import zipfile

artifact_path = os.path.abspath(sys.argv[1])

with zipfile.ZipFile(artifact_path, 'r') as zf:
    names = set(zf.namelist())
    if 'package.json' not in names:
        raise SystemExit('package.json missing in artifact root.')

print('Artifact validation passed: package.json found at root')
PY

log "Deploying to Azure Web App: $APP_NAME"
set +e
deploy_output="$(az webapp deploy \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_NAME" \
  --src-path "$ARTIFACT_PATH" \
  --type zip \
  --track-status false \
  -o json 2>&1)"
deploy_exit_code=$?
set -e

if (( deploy_exit_code != 0 )); then
  log "Azure CLI returned a non-zero deploy result (code=$deploy_exit_code). Continuing with health-based validation."
  echo "$deploy_output"
else
  echo "$deploy_output"
fi

show_latest_deploy_summary

log "Waiting for healthy backend response"
if ! wait_for_healthy_backend; then
  show_latest_deploy_summary
  az webapp log deployment show -g "$RESOURCE_GROUP" -n "$APP_NAME" || true
  fail "Backend health check failed after deployment"
fi

latest_status="$(az webapp log deployment list -g "$RESOURCE_GROUP" -n "$APP_NAME" --query "[0].status" -o tsv | tr -d '\r')"
if [[ "$latest_status" != "4" ]]; then
  log "Warning: Azure deployment status is '$latest_status' but backend health is passing. Proceeding as healthy deploy."
fi

log "Backend deployment completed successfully"
