# Deployment Super Detailed V2

## 0) Document Intent
This runbook is the operational source of truth for deploying Memora frontend and backend with concrete commands, expected outputs, error signatures, and rectification paths.
It is designed so any team member can execute deployment safely even without prior chat context.

## 1) System topology and deployment targets

### Frontend
- Stack: Vite + React
- Root path: `memora-frontend`
- Deployment platform: Vercel
- Production alias: `memoraapp-next.vercel.app`

### Backend
- Stack: Node/Express
- Root path: `memora-backend`
- Deployment platform: Azure App Service (zip deploy)
- Default app name in scripts: `memora-api-04021453`
- Default resource group in scripts: `memora-prod-rg`

### Static/API routing behavior
Frontend uses rewrite routing to backend for API/upload paths via `vercel.json`.

## 2) Preflight checklist (must pass before deploy)

1. Verify current branch and working tree
```bash
git status
```
Expected:
- You are on intended branch (`main` or hotfix branch)
- No accidental uncommitted changes

2. Confirm Node and package manager consistency
```bash
node -v
npm -v
```
Expected:
- Node major compatible with project build

3. Confirm frontend builds locally
```bash
cd memora-frontend
npm ci
npm run build
```
Expected:
- Build success
- Large chunk warning is acceptable (non-blocking)

4. Confirm backend starts in local/dev mode when needed
```bash
cd ../memora-backend
npm ci
npm run dev
```
Expected:
- Health endpoint responds

5. Verify required CLIs
```bash
vercel --version
az --version
```
Expected:
- Both available in PATH

## 3) Frontend deployment (recommended script path)

### Standard command
```bash
cd "c:/Users/Harsith Veera Charan/Downloads/Imp Items/Memora v1"
bash scripts/deploy-frontend-vercel.sh memoraapp-next.vercel.app
```

### What the script does
1. Pulls Vercel production environment
2. Builds prebuilt output
3. Deploys production build
4. Assigns alias to `memoraapp-next.vercel.app`

### Success criteria
- Script prints deployment URL
- Alias assignment success line appears
- Production URL loads latest UI

## 4) Frontend deployment (manual fallback)
Use this when script behavior or CLI flags differ by version.

```bash
cd memora-frontend
vercel pull --yes --environment=production
vercel build --prod
vercel deploy --prebuilt --prod --yes
vercel alias set <deployment-url> memoraapp-next.vercel.app
```

## 5) Backend deployment (recommended script path)

### Standard command
```bash
cd "c:/Users/Harsith Veera Charan/Downloads/Imp Items/Memora v1"
bash scripts/deploy-backend-azure.sh memora-prod-rg memora-api-04021453
```

### What the script does
1. Creates fresh zip artifact from backend folder
2. Syncs artifact copy for consistency
3. Runs Azure zip deploy
4. Performs health check

### Success criteria
- Azure deploy command returns success JSON
- Health check endpoint responds

## 6) CI workflow paths

### Frontend GitHub workflow
- File: `.github/workflows/deploy-frontend-vercel.yml`
- Trigger: push to main on frontend/workflow path changes or manual dispatch
- Required secrets:
  - `VERCEL_TOKEN`
  - `VERCEL_ORG_ID`
  - `VERCEL_PROJECT_ID`

### Backend GitHub workflow
- File: `.github/workflows/deploy-backend-azure.yml`
- Trigger: push to main on backend/workflow path changes or manual dispatch
- Required secret/vars:
  - `AZURE_WEBAPP_PUBLISH_PROFILE_BACKEND`
  - `AZURE_BACKEND_WEBAPP_NAME`

## 7) Known errors and rectification

### Error A: Vercel CLI unknown option `--quiet`
Signature:
```text
Error: unknown or unexpected option: --quiet
```
Cause:
- CLI version mismatch with flag support.
Rectification:
1. Remove `--quiet` from script/workflow deploy command.
2. Parse deployment URL from command output robustly.
Status:
- Already fixed in:
  - `scripts/deploy-frontend-vercel.sh`
  - `.github/workflows/deploy-frontend-vercel.yml`

### Error B: Deployment URL parse returns empty
Signature:
- Alias step fails due empty URL variable.
Cause:
- Command output format changed.
Rectification:
- Extract with regex:
```bash
echo "$DEPLOYMENT_OUTPUT" | grep -Eo 'https://[^ ]+\.vercel\.app' | tail -n1
```
- Exit with failure if URL empty.

### Error C: Alias points to stale deployment
Signature:
- `memoraapp-next.vercel.app` shows old build while new deployment exists.
Cause:
- Alias not updated.
Rectification:
```bash
vercel alias set <latest-deployment-url> memoraapp-next.vercel.app
```
Verify by loading alias URL after cache refresh.

### Error D: Azure zip deploy fails with corrupted artifact
Signature:
- Recurrent zip deploy failures.
Cause:
- Old/corrupt zip reused.
Rectification:
1. Always generate fresh zip before deploy.
2. Replace stale artifact.
3. Redeploy.

### Error E: `cygpath` not found in shell
Signature:
```text
[backend] cygpath is required in this shell environment.
```
Cause:
- Shell missing required utility.
Rectification:
- Run from Git Bash with MSYS utilities.
- Or adapt script to pure PowerShell path handling.

### Error F: Azure CLI not authenticated
Signature:
```text
Please run 'az login' to setup account.
```
Rectification:
```bash
az login
az account set --subscription <subscription-id-or-name>
```

### Error G: Backend health check returns non-200 post deploy
Likely causes:
- Missing env vars
- Startup command mismatch
- DB connectivity/CORS/config issue
Rectification sequence:
1. Confirm app settings in Azure App Service
2. Confirm `MONGODB_URI`
3. Restart app service
4. Check logs
5. Retest `/api/health`

## 8) Environment variables checklist

### Backend critical vars
- `NODE_ENV=production`
- `PORT=8080`
- `MONGODB_URI=<atlas-uri>`
- `JWT_SECRET=<secret>`
- `JWT_REFRESH_SECRET=<secret>`
- `FRONTEND_URLS=https://memoraapp-next.vercel.app`
- `FILE_STORAGE_PROVIDER=azure`
- `AZURE_STORAGE_CONNECTION_STRING=<value>`
- `AZURE_STORAGE_CONTAINER_NAME=uploads`

### Frontend critical vars
- Ensure Vercel project env points API base correctly
- Rewrites in `memora-frontend/vercel.json` match backend URL

## 9) Post-deploy validation matrix

### Automated smoke test (recommended first check)
```bash
cd "c:/Users/Harsith Veera Charan/Downloads/Imp Items/Memora v1"
bash scripts/smoke-test-prod.sh https://memoraapp-next.vercel.app https://memora-api-04021453.azurewebsites.net
```

Interpretation note:
- If Azure deployment status is marked failed but all smoke checks pass, treat runtime as healthy and avoid immediate rollback.

### Frontend
1. Load app home
2. Login flow
3. Graph page load
4. Graph navbar behavior:
  - Maximize visible initially
  - Time Lapse appears only in maximized view
  - Time Lapse appears to left of Maximize
5. Zoom and center-and-fit behavior

### Backend
1. `/api/health` responds
2. Auth endpoint functional
3. Topic fetch/create endpoints functional
4. DocTag upload/read endpoint functional

### Integration
1. Frontend API calls route correctly
2. CORS not blocking production origin
3. Uploaded assets retrievable

## 10) Rollback strategy

### Frontend rollback
1. List recent deployments in Vercel UI/CLI.
2. Reassign alias to prior stable deployment.
```bash
vercel alias set <previous-stable-url> memoraapp-next.vercel.app
```
3. Validate smoke checks.

### Backend rollback
1. Redeploy last known-good zip artifact.
2. Restart app service.
3. Re-run health checks.

## 11) Release cut protocol

1. Freeze merges during deploy window.
2. Run preflight checks.
3. Deploy frontend.
4. Deploy backend (if backend changes exist).
5. Run validation matrix.
6. Record release note.
7. Tag release.

## 12) Operational run commands (copy/paste section)

### Frontend full run
```bash
cd "c:/Users/Harsith Veera Charan/Downloads/Imp Items/Memora v1/memora-frontend"
npm ci
npm run build
cd ..
bash scripts/deploy-frontend-vercel.sh memoraapp-next.vercel.app
```

### Frontend manual fallback
```bash
cd "c:/Users/Harsith Veera Charan/Downloads/Imp Items/Memora v1/memora-frontend"
vercel pull --yes --environment=production
vercel build --prod
vercel deploy --prebuilt --prod --yes
vercel alias set <deployment-url> memoraapp-next.vercel.app
```

### Backend full run
```bash
cd "c:/Users/Harsith Veera Charan/Downloads/Imp Items/Memora v1"
bash scripts/deploy-backend-azure.sh memora-prod-rg memora-api-04021453
```

## 13) Observability and maintenance

1. Keep deploy logs archived per release.
2. Maintain a small changelog per deploy with commit hash.
3. Re-check Vercel/Azure CLI versions monthly.
4. Validate CI workflow commands whenever CLI major changes occur.
5. Rotate secrets periodically and after team member transitions.

## 14) Before chat continuity loss: recommended preparation plan

### A) Documentation hardening
- Keep these three files as canonical handoff docs:
  - `copoilot-v2-executive-summary.md`
  - `copoilot-v2-summary-file.md`
  - `DEPLOYMENT_SUPER_DETAILED_V2.md`
- Add owner names and dates at top of each file.

### B) Automation hardening
- Add a `scripts/smoke-test-prod.sh` that verifies core frontend/backend endpoints.
- Add one CI job that validates deployment URL parsing in dry-run mode.

### C) Release safety
- Create a release checklist markdown in repo root and enforce in PR template.
- Tag the current stable release immediately.

### D) Knowledge transfer
- Record a 10-15 minute walkthrough for:
  - Frontend deploy
  - Backend deploy
  - Rollback
  - Graph-mode specific checks

### E) Data/ops safeguards
- Ensure DB backup policy is documented and tested.
- Export and store all required secrets in a shared vault with at least two maintainers.

## 15) Final note
This file is intentionally deep and operationally actionable.
Use it as the default runbook for production deployments and incident response related to deployment issues.
