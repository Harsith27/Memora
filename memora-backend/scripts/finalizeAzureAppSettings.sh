#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   MONGODB_URI='mongodb+srv://...' \
#   FRONTEND_URLS='https://your-app.vercel.app' \
#   GEMINI_API_KEY='...' \
#   ./scripts/finalizeAzureAppSettings.sh

APP_NAME="${APP_NAME:-memora-api-04021453}"
RESOURCE_GROUP="${RESOURCE_GROUP:-memora-prod-rg}"
AZ_CLI="${AZ_CLI:-/c/Program Files/Microsoft SDKs/Azure/CLI2/wbin/az.cmd}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env}"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a
  source "$ENV_FILE"
  set +a
fi

if [[ -n "${PROD_MONGODB_URI:-}" ]]; then
  MONGODB_URI="$PROD_MONGODB_URI"
elif [[ -z "${MONGODB_URI:-}" && -n "${PROD_MONGODB_URI:-}" ]]; then
  MONGODB_URI="$PROD_MONGODB_URI"
fi

if [[ -z "${MONGODB_URI:-}" ]]; then
  echo "Missing required env var: MONGODB_URI"
  exit 1
fi

if [[ "$MONGODB_URI" == mongodb://localhost* ]]; then
  echo "Refusing to push localhost MONGODB_URI to Azure. Set PROD_MONGODB_URI or MONGODB_URI to your Atlas connection string."
  exit 1
fi

SETTINGS=(
  "MONGODB_URI=${MONGODB_URI}"
)

if [[ -n "${FRONTEND_URLS:-}" ]]; then
  SETTINGS+=("FRONTEND_URLS=${FRONTEND_URLS}")
fi

if [[ -n "${AI_PROVIDER:-}" ]]; then
  SETTINGS+=("AI_PROVIDER=${AI_PROVIDER}")
fi

if [[ -n "${GEMINI_API_KEY:-}" ]]; then
  SETTINGS+=("GEMINI_API_KEY=${GEMINI_API_KEY}")
fi

if [[ -n "${GROQ_API_KEY:-}" ]]; then
  SETTINGS+=("GROQ_API_KEY=${GROQ_API_KEY}")
fi

if [[ -n "${GROQ_MODEL:-}" ]]; then
  SETTINGS+=("GROQ_MODEL=${GROQ_MODEL}")
fi

if [[ -n "${GROQ_BASE_URL:-}" ]]; then
  SETTINGS+=("GROQ_BASE_URL=${GROQ_BASE_URL}")
fi

if [[ -n "${GROQ_TRANSCRIBE_MODEL:-}" ]]; then
  SETTINGS+=("GROQ_TRANSCRIBE_MODEL=${GROQ_TRANSCRIBE_MODEL}")
fi

if [[ -n "${GROQ_SUMMARY_MODEL:-}" ]]; then
  SETTINGS+=("GROQ_SUMMARY_MODEL=${GROQ_SUMMARY_MODEL}")
fi

"${AZ_CLI}" webapp config appsettings set \
  --name "${APP_NAME}" \
  --resource-group "${RESOURCE_GROUP}" \
  --settings "${SETTINGS[@]}" \
  --output table

"${AZ_CLI}" webapp restart --name "${APP_NAME}" --resource-group "${RESOURCE_GROUP}" --output table

echo "Azure app settings finalized and app restarted."
