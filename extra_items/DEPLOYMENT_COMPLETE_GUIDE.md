# Memora v1 - Complete Deployment & Cleanup Guide

**Last Updated:** May 9, 2026  
**Project:** Memora v1 (Learning Management System)  
**Status:** Production-Ready

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Pre-Deployment Checklist](#pre-deployment-checklist)
3. [Deployment Steps](#deployment-steps)
4. [Post-Deployment Verification](#post-deployment-verification)
5. [Rollback Procedures](#rollback-procedures)
6. [Complete Resource Cleanup](#complete-resource-cleanup)
7. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### Infrastructure
- **Frontend:** Vercel (memoraapp-next.vercel.app)
- **Backend:** Azure App Service (memora-api-04021453.azurewebsites.net)
- **Database:** MongoDB Atlas (Production Cluster)
- **Storage:** Azure Blob Storage (for file uploads)

### Technology Stack
- **Frontend:** React 19 + Vite + Tailwind CSS v4
- **Backend:** Node.js + Express + Mongoose
- **AI Integration:** Groq LLM (for mindmap generation)
- **Authentication:** JWT (localStorage-based on client)

### Key Features Deployed This Session
- ✅ Revision scheduling modes (Competitive, Engineering, Hybrid)
- ✅ Mindmap quality improvements (hardened prompts, better layout)
- ✅ Per-topic revision mode overrides
- ✅ Dashboard timeline preview mode-awareness

---

## Pre-Deployment Checklist

Before deploying, verify:

- [ ] All backend syntax passes: `node -c models/*.js routes/*.js`
- [ ] Frontend builds cleanly: `npm run build` (no compile errors)
- [ ] Environment variables configured in Azure portal
- [ ] MongoDB Atlas connection string valid
- [ ] Vercel project linked to GitHub repo
- [ ] SSL certificates valid for domains
- [ ] Database backups taken (optional but recommended)

### Environment Variables Required

**Azure App Service (Backend):**
```
NODE_ENV=production
PORT=8080
JWT_SECRET=<secure-random-string>
JWT_REFRESH_SECRET=<secure-random-string>
MONGODB_URI=<atlas-connection-string>
FRONTEND_URLS=https://memoraapp-next.vercel.app
GROQ_API_KEY=<groq-api-key>
UPLOAD_STORAGE_TYPE=azure
AZURE_STORAGE_ACCOUNT_NAME=<storage-account>
AZURE_STORAGE_ACCOUNT_KEY=<storage-key>
AZURE_CONTAINER_NAME=memora-uploads
```

**Vercel Frontend:**
```
VITE_API_URL=https://memora-api-04021453.azurewebsites.net
```

---

## Deployment Steps

### Option A: Full Automated Deployment (Recommended)

#### Step 1: Backend Deployment to Azure

```bash
cd c:/Users/Harsith\ Veera\ Charan/Downloads/Imp\ Items/Memora\ v1

# Run the automated backend deployment script
bash scripts/deploy-backend-azure.sh

# This script will:
# 1. Validate required Azure app settings
# 2. Create a deployment artifact (ZIP)
# 3. Upload to Azure Web App
# 4. Monitor deployment progress
# 5. Verify health endpoint after deployment
```

**Expected Output:**
```
[backend] Validating required Azure app settings
[backend] Creating fresh deploy artifact
[backend] Deploying to Azure Web App: memora-api-04021453
[backend] Deployment successful
[backend] Health check: ✓ https://memora-api-04021453.azurewebsites.net/api/health
```

#### Step 2: Frontend Deployment to Vercel

```bash
# Deploy to Vercel preview first (optional)
bash scripts/deploy-frontend-vercel.sh memoraapp-next.vercel.app https://memora-api-04021453.azurewebsites.net/api/health preview

# Or deploy directly to production
bash scripts/deploy-frontend-vercel.sh memoraapp-next.vercel.app https://memora-api-04021453.azurewebsites.net/api/health production
```

**Expected Output:**
```
[frontend] Deploying to Vercel...
[frontend] Deployment URL: https://memora-app-prod-xyz.vercel.app
[frontend] Health check: ✓ Backend API reachable
[frontend] Deployment successful
```

### Option B: Manual Deployment

#### Backend Manual Deployment

```bash
cd c:/Users/Harsith\ Veera\ Charan/Downloads/Imp\ Items/Memora\ v1/memora-backend

# Install dependencies (if needed)
npm install --production

# Create deployment package
npm run build  # If there's a build script

# Create ZIP artifact
cd ..
zip -r backend-deploy-manual.zip memora-backend/

# Deploy to Azure using Azure CLI
az webapp deployment source config-zip \
  --resource-group memora-prod-rg \
  --name memora-api-04021453 \
  --src backend-deploy-manual.zip

# Verify deployment
curl https://memora-api-04021453.azurewebsites.net/api/health
```

#### Frontend Manual Deployment

```bash
cd c:/Users/Harsith\ Veera\ Charan/Downloads/Imp\ Items/Memora\ v1/memora-frontend

# Install dependencies
npm install

# Build
npm run build

# Deploy using Vercel CLI
vercel deploy --prod

# Or push to GitHub and Vercel will auto-deploy
git push origin main
```

---

## Post-Deployment Verification

### 1. Health Checks

```bash
# Backend health check
curl -i https://memora-api-04021453.azurewebsites.net/api/health

# Frontend health check (should return HTML)
curl -i https://memoraapp-next.vercel.app

# Both should return HTTP 200
```

### 2. Feature Verification

**Revision Modes:**
1. Login to app at https://memoraapp-next.vercel.app
2. Go to Profile → Learning tab
3. Verify 3 mode cards display (Competitive, Engineering, Hybrid)
4. Create test topic with "Engineering" mode
5. Dashboard timeline should show fewer revisions for that topic

**Mindmap Quality:**
1. Create new topic
2. Click "Generate Mindmap"
3. Verify structure is clean (no overly long labels as topic nodes)
4. Check spacing is adequate (not cramped)

**Database Connectivity:**
```bash
# Verify database is accessible from backend
# Check Azure App Service Logs:
az webapp log tail --resource-group memora-prod-rg --name memora-api-04021453

# Look for successful MongoDB connections and no error messages
```

### 3. User Acceptance Testing (UAT)

- [ ] Create account and login
- [ ] Create topic with each revision mode
- [ ] Verify timeline preview reflects mode choice
- [ ] Test global mode switching
- [ ] Test per-topic mode override
- [ ] Generate mindmap and verify quality
- [ ] Test all core features (journals, tasks, achievements, etc.)

---

## Rollback Procedures

### Scenario 1: Backend Deployment Failed

```bash
# Option A: Revert to previous slot (if using staging slots)
az webapp deployment slot swap \
  --resource-group memora-prod-rg \
  --name memora-api-04021453 \
  --slot staging

# Option B: Redeploy previous version from backup
# 1. List deployment history
az webapp deployment list-publishing-profiles \
  --resource-group memora-prod-rg \
  --name memora-api-04021453

# 2. Re-deploy from last known good artifact
bash scripts/deploy-backend-azure.sh

# Option C: Manual rollback
# 1. Download previous backend-deploy-current.zip
# 2. Deploy that version
az webapp deployment source config-zip \
  --resource-group memora-prod-rg \
  --name memora-api-04021453 \
  --src backend-deploy-current.zip
```

### Scenario 2: Frontend Deployment Failed

```bash
# Vercel automatically keeps deployment history
# Rollback via Vercel dashboard:
# 1. Go to Vercel Dashboard > Deployments
# 2. Find last successful deployment
# 3. Click "Promote to Production"

# Or via CLI:
vercel rollback
```

### Scenario 3: Database Issues

```bash
# Check MongoDB Atlas connectivity
mongo "mongodb+srv://user:pass@cluster.mongodb.net/memora" --eval "db.adminCommand('ping')"

# If connection lost, verify:
# 1. IP whitelist in MongoDB Atlas (add Azure IP ranges)
# 2. Connection string in Azure app settings
# 3. Network security groups allow outbound to MongoDB

# Restart backend to reconnect
az webapp restart \
  --resource-group memora-prod-rg \
  --name memora-api-04021453
```

---

## Complete Resource Cleanup

### ⚠️ WARNING: This Will Delete ALL Resources and Data

Only run this if you want to completely remove the project from Azure/Vercel.

### Step 1: Backup Data (CRITICAL)

```bash
# Backup MongoDB database
mongoexport \
  --uri "mongodb+srv://user:pass@cluster.mongodb.net/memora" \
  --db memora \
  --collection users \
  --out memora-users-backup.json

mongoexport \
  --uri "mongodb+srv://user:pass@cluster.mongodb.net/memora" \
  --db memora \
  --collection topics \
  --out memora-topics-backup.json

# Backup all collections
for collection in users topics journals tasks achievements doctags revisionhistory memscore memscorehistory; do
  mongoexport \
    --uri "mongodb+srv://user:pass@cluster.mongodb.net/memora" \
    --db memora \
    --collection $collection \
    --out memora-$collection-backup.json
done

# Store backups in secure location
zip -r memora-backup-$(date +%Y%m%d).zip *.json
```

### Step 2: Delete Azure Resources

```bash
# List all resources in resource group
az resource list --resource-group memora-prod-rg

# Delete entire resource group (deletes all resources at once)
az group delete \
  --name memora-prod-rg \
  --yes

# Or delete individual resources:

# Delete App Service
az webapp delete \
  --resource-group memora-prod-rg \
  --name memora-api-04021453

# Delete App Service Plan
az appservice plan delete \
  --resource-group memora-prod-rg \
  --name memora-plan

# Delete Storage Account
az storage account delete \
  --resource-group memora-prod-rg \
  --name memorastorage

# Delete Resource Group
az group delete --name memora-prod-rg --yes
```

### Step 3: Delete Vercel Project

```bash
# Option A: Via CLI
vercel remove --confirm

# Option B: Via Dashboard
# 1. Go to Vercel Dashboard
# 2. Settings → Danger Zone → Delete Project
# 3. Type project name to confirm
```

### Step 4: MongoDB Atlas Cleanup

```bash
# Via MongoDB Atlas Web UI:
# 1. Go to Database Deployments
# 2. Select "memora" cluster
# 3. Terminate Cluster
# 4. Delete Organization (if not needed)

# Via Atlas CLI:
atlas cluster delete memora --force
```

### Step 5: GitHub Cleanup (Optional)

```bash
# Delete local repository
rm -rf "c:/Users/Harsith Veera Charan/Downloads/Imp Items/Memora v1"

# Delete GitHub repository:
# 1. Go to GitHub repo → Settings
# 2. Scroll to "Danger Zone"
# 3. Delete Repository
# 4. Type repo name to confirm
```

### Verification After Cleanup

```bash
# Verify resources are deleted
az resource list --resource-group memora-prod-rg

# Should return: "The resource group 'memora-prod-rg' could not be found"

# Verify app is down
curl https://memora-api-04021453.azurewebsites.net
# Should fail with connection error

curl https://memoraapp-next.vercel.app
# Should fail with 404 or similar
```

---

## Troubleshooting

### Backend Deployment Issues

**Problem:** `[backend] ERROR: Missing required Azure app settings: NODE_ENV`

**Solution:**
```bash
# Set missing app settings
az webapp config appsettings set \
  --resource-group memora-prod-rg \
  --name memora-api-04021453 \
  --settings NODE_ENV=production JWT_SECRET=your-secret
```

**Problem:** Deployment times out after 5 minutes

**Solution:**
```bash
# Check deployment logs
az webapp log tail --resource-group memora-prod-rg --name memora-api-04021453

# Restart the app
az webapp restart --resource-group memora-prod-rg --name memora-api-04021453

# Increase timeout and retry
timeout 300 bash scripts/deploy-backend-azure.sh
```

**Problem:** `npm install` fails during deployment

**Solution:**
```bash
# Clear npm cache
npm cache clean --force

# Rebuild deployment artifact
cd memora-backend && npm ci --production && cd ..
zip -r backend-deploy-manual.zip memora-backend/

# Re-deploy
az webapp deployment source config-zip \
  --resource-group memora-prod-rg \
  --name memora-api-04021453 \
  --src backend-deploy-manual.zip
```

### Frontend Deployment Issues

**Problem:** `[frontend] ERROR: Backend health check failed`

**Solution:**
```bash
# Verify backend is running
curl https://memora-api-04021453.azurewebsites.net/api/health

# If down, restart backend
az webapp restart --resource-group memora-prod-rg --name memora-api-04021453

# Wait 30 seconds and redeploy frontend
sleep 30
bash scripts/deploy-frontend-vercel.sh
```

**Problem:** Vercel build fails with out-of-memory

**Solution:**
```bash
# Locally build and test
npm run build

# If successful locally, Vercel build issue may be transient
# Try re-deploying
vercel deploy --prod

# Or push to trigger new build
git commit --allow-empty -m "Trigger rebuild"
git push origin main
```

### Database Connection Issues

**Problem:** MongoDB connection timeout

**Solution:**
```bash
# Check connection string format
# Should be: mongodb+srv://username:password@cluster.mongodb.net/dbname?retryWrites=true&w=majority

# Test from local machine
mongo "your-connection-string" --eval "db.adminCommand('ping')"

# If local fails but Azure succeeds, issue may be IP whitelist
# Add your home IP and Azure IP ranges to MongoDB Atlas

# If Azure fails, restart backend to re-establish connection
az webapp restart --resource-group memora-prod-rg --name memora-api-04021453
```

**Problem:** "Access token required" errors in UI

**Solution:**
```bash
# Verify JWT secrets match between frontend and backend
# Check Azure app settings
az webapp config appsettings list \
  --resource-group memora-prod-rg \
  --name memora-api-04021453 | grep JWT

# If secrets mismatch, update
az webapp config appsettings set \
  --resource-group memora-prod-rg \
  --name memora-api-04021453 \
  --settings JWT_SECRET=your-new-secret
```

---

## Quick Reference Commands

### Deployment
```bash
# Full deployment
bash scripts/deploy-backend-azure.sh
bash scripts/deploy-frontend-vercel.sh

# Health check
curl https://memora-api-04021453.azurewebsites.net/api/health
```

### Monitoring
```bash
# View backend logs
az webapp log tail --resource-group memora-prod-rg --name memora-api-04021453

# View deployment history
az webapp deployment list-publishing-profiles --resource-group memora-prod-rg --name memora-api-04021453
```

### Restart Services
```bash
# Restart backend
az webapp restart --resource-group memora-prod-rg --name memora-api-04021453

# Redeploy frontend
vercel deploy --prod
```

### Cleanup
```bash
# Delete everything
az group delete --name memora-prod-rg --yes
vercel remove --confirm
```

---

## Support & Documentation

- **Backend API Docs:** `/api/docs` (if Swagger enabled)
- **Frontend Repo:** GitHub (check README.md)
- **Database Schema:** `memora-backend/models/`
- **Environment Setup:** `.env.example` in each folder

---

**Last Deployed:** [Will be updated after deployment]  
**Deployed By:** AI Assistant  
**Version:** 1.0.0
