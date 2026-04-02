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

if [[ -z "${MONGODB_URI:-}" ]]; then
  echo "Missing required env var: MONGODB_URI"
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

"${AZ_CLI}" webapp config appsettings set \
  --name "${APP_NAME}" \
  --resource-group "${RESOURCE_GROUP}" \
  --settings "${SETTINGS[@]}" \
  --output table

"${AZ_CLI}" webapp restart --name "${APP_NAME}" --resource-group "${RESOURCE_GROUP}" --output table

echo "Azure app settings finalized and app restarted."
