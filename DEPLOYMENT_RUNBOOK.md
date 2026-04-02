# Memora Deployment Runbook (Vercel + Azure + Atlas)

This runbook is ordered by dependencies so each step unlocks the next one.

## Current Provisioning Status (2026-04-02)

The following Azure resources are already provisioned:

- Subscription: `Azure for Students (cf876e00-657f-4def-b9d4-231369d1c17e)`
- Resource Group: `memora-prod-rg`
- Region used for resources: `southeastasia`
- Storage Account: `memorastg04021453`
- Blob Container: `uploads`
- App Service Plan: `memora-prod-plan` (Linux B1)
- Web App: `memora-api-04021453`
- Backend URL: `https://memora-api-04021453.azurewebsites.net`

Important subscription policy note:

- This subscription enforces an allowed region policy.
- Allowed locations detected: `eastasia`, `southeastasia`, `malaysiawest`, `koreacentral`, `austriaeast`.
- If creation fails in other regions, switch to one of the above.

## 1) Prepare Production Secrets

Generate and store these securely (do not commit):

- `JWT_SECRET` (64-byte hex)
- `JWT_REFRESH_SECRET` (64-byte hex)
- `MONGODB_URI` (Atlas connection string)
- `AZURE_STORAGE_CONNECTION_STRING`

Required backend app settings:

- `NODE_ENV=production`
- `PORT=8080`
- `MONGODB_URI=<atlas-uri>`
- `JWT_SECRET=<secret>`
- `JWT_REFRESH_SECRET=<secret>`
- `JWT_EXPIRE=24h`
- `JWT_REFRESH_EXPIRE=7d`
- `FRONTEND_URLS=https://<your-vercel-domain>.vercel.app`
- `ALLOW_VERCEL_PREVIEWS=true`
- `ALLOW_LOCALHOST_CORS=false`
- `BACKEND_PUBLIC_URL=https://<your-backend-app>.azurewebsites.net`
- `FILE_STORAGE_PROVIDER=azure`
- `AZURE_STORAGE_CONNECTION_STRING=<connection-string>`
- `AZURE_STORAGE_CONTAINER_NAME=uploads`
- `AI_PROVIDER=gemini` (or `groq`)
- `GEMINI_API_KEY=<key>` (if provider is gemini)
- `GROQ_API_KEY=<key>` (if provider is groq)
- `BCRYPT_SALT_ROUNDS=12`
- `ENABLE_RATE_LIMIT=true`
- `RATE_LIMIT_WINDOW_MS=900000`
- `RATE_LIMIT_MAX_REQUESTS=100`

Required frontend env:

- `VITE_API_URL=https://<your-backend-app>.azurewebsites.net/api`

## 2) Atlas Setup (Dependency: none)

1. Create Atlas cluster.
2. Create DB user with readWrite on database `memora`.
3. Allow network access for Azure App Service outbound IPs (or temporary `0.0.0.0/0` for first deploy test).
4. Copy `MONGODB_URI`.

After you have `MONGODB_URI`, you can apply final app settings quickly with:

```bash
cd memora-backend
MONGODB_URI='mongodb+srv://...' \
FRONTEND_URLS='https://<your-vercel-domain>.vercel.app' \
./scripts/finalizeAzureAppSettings.sh
```

## 3) Azure Storage Blob Setup (Dependency: Azure account)

1. Create storage account.
2. Create container named `uploads`.
3. Get connection string.
4. Save into `AZURE_STORAGE_CONNECTION_STRING`.

## 4) Azure App Service Backend Setup (Dependency: secrets ready)

1. Create App Service (Node 20+ runtime).
2. Set Startup Command to:
   - `npm start`
3. Add all backend app settings listed in step 1.
4. Restart the app.
5. Validate health endpoint:
   - `https://<your-backend-app>.azurewebsites.net/api/health`

## 5) Vercel Frontend Setup (Dependency: backend URL)

1. Import repository in Vercel.
2. Set Root Directory to `memora-frontend`.
3. Add environment variable:
   - `VITE_API_URL=https://<your-backend-app>.azurewebsites.net/api`
4. Deploy.

## 6) CORS Finalization (Dependency: Vercel domain known)

Update backend app settings:

- `FRONTEND_URLS=https://<your-vercel-domain>.vercel.app`

Restart backend and retest login + DocTag upload + DocTag preview.

## 7) Optional GitHub Actions Automation

Two workflows are included:

- `.github/workflows/deploy-backend-azure.yml`
- `.github/workflows/deploy-frontend-vercel.yml`

Add these GitHub secrets/variables before using them:

Backend workflow:

- Secret: `AZURE_WEBAPP_PUBLISH_PROFILE_BACKEND`
- Variable: `AZURE_BACKEND_WEBAPP_NAME`

Frontend workflow:

- Secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`

## 8) Smoke Test Checklist

- Register and login work from Vercel UI.
- Create topic and review topic.
- Upload DocTag file and confirm in-app preview works.
- Confirm `/api/health` is healthy.
- Confirm database writes appear in Atlas.
