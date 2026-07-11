# Comprehensive Technical Error Audit for Memora

This document provides a highly detailed audit of identified bugs, misconfigurations, and functional gaps in the Memora repository. Each entry includes files, line references, root cause analysis, error signatures, and exact remediation protocols.

---

## 1. CI/CD Pipeline Context Breakdown (Vercel Frontend)

### Location
* **File:** [.github/workflows/deploy-frontend-vercel.yml](file:///c:/Harsith_Dev/Memora/.github/workflows/deploy-frontend-vercel.yml#L28-L32)

### The Bug
In the "Pull Vercel Environment Information" step, the workflow attempts to execute the `vercel pull` command to download environment credentials for production. However, it only provides `VERCEL_TOKEN` in the environment block:

```yaml
- name: Pull Vercel Environment Information
  working-directory: memora-frontend
  env:
    VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
  run: vercel pull --yes --environment=production --token "$VERCEL_TOKEN"
```

### Root Cause
In a headless Continuous Integration environment, Vercel CLI has no local project cache or session. To determine which project configuration to fetch, `vercel pull` **must** receive both the organization ID (`VERCEL_ORG_ID`) and the project ID (`VERCEL_PROJECT_ID`). Because these are missing in the step's environment configuration block, the execution will crash with a missing context error:
`Error: Could not find a project. Please run vercel link or set VERCEL_ORG_ID and VERCEL_PROJECT_ID.`

### Remediation
Update the `env` configuration of the pulling step to expose the two missing target variables:
```yaml
- name: Pull Vercel Environment Information
  working-directory: memora-frontend
  env:
    VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
    VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
    VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
  run: vercel pull --yes --environment=production --token "$VERCEL_TOKEN"
```

---

## 2. Broken SEO Crawling & Root Wildcard Rewrites

### Location
* **Directory:** `memora-frontend/` (No `public/` directory exists)
* **Configuration:** [vercel.json](file:///c:/Harsith_Dev/Memora/memora-frontend/vercel.json#L12-L15)

### The Bug
Search engine crawlers or verification bots attempting to download `https://memyapp.vercel.app/sitemap.xml` or `https://memyapp.vercel.app/robots.txt` are served the frontend's main HTML layout (`index.html`) instead of plain XML or text, causing parser exceptions in indexing systems.

### Root Cause
1. In React SPAs built with Vite, all root-level static files (like site maps, robots instructions, PWA manifests, and icons) must be housed in a directory called `public` at the frontend root directory. During execution of `npm run build`, Vite copies everything inside `public/` directly to the `dist/` directory root. Currently, this `public` folder is entirely missing from the workspace.
2. Vercel's rewrite routing logic in `vercel.json` contains a catch-all route at the bottom:
   ```json
   {
     "source": "/(.*)",
     "destination": "/index.html"
   }
   ```
   Since no physical file named `sitemap.xml` or `robots.txt` exists in the deployment bundle, the wildcard rule intercepts the request and rewrites the target route to `/index.html`. The client receives a status `200` but with HTML document contents, causing XML parsing errors for search engines.

### Remediation
Create the folder `memora-frontend/public/` and add valid `sitemap.xml` and `robots.txt` files inside it.

---

## 3. SEO Canonical Target Mismatches

### Locations
* **File:** [SeoManager.jsx](file:///c:/Harsith_Dev/Memora/memora-frontend/src/components/SeoManager.jsx#L5)
* **File:** [index.html](file:///c:/Harsith_Dev/Memora/memora-frontend/index.html#L17)

### The Bug
The live deployment operates on `https://memyapp.vercel.app/`, but core components and pages declare canonical tags pointing to `https://memy.vercel.app/`.

### Root Cause
`SeoManager.jsx` sets:
```javascript
const SITE_URL = 'https://memy.vercel.app';
```
And `index.html` sets:
```html
<link rel="canonical" href="https://memy.vercel.app/" />
```
This inconsistency forces search engine crawlers to map page indices back to an incorrect domain, splitting page authority and degrading indexing metrics.

### Remediation
Synchronize the canonical URL references to use `https://memyapp.vercel.app/`.

---

## 4. Massive Build Package Bloat in Azure CI Backend Workflow

### Location
* **File:** [.github/workflows/deploy-backend-azure.yml](file:///c:/Harsith_Dev/Memora/.github/workflows/deploy-backend-azure.yml#L31-L37)

### The Bug
The backend CD pipeline takes a long time to upload and occasionally triggers timeout failures because the packaged bundle contains all installed node modules.

### Root Cause
In the workflow, `npm ci` is executed at the root level of the GitHub actions runner. The deployment step is configured as:
```yaml
- name: Deploy to Azure Web App
  uses: azure/webapps-deploy@v3
  with:
    app-name: ${{ vars.AZURE_BACKEND_WEBAPP_NAME }}
    publish-profile: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE_BACKEND }}
    package: memora-backend
```
Because `package: memora-backend` points directly to the workspace folder, the action compresses the entire directory—including `node_modules` (which contains both production and devDependencies like `nodemon`)—and uploads it. This increases the ZIP package size from ~2MB to over ~120MB.

### Remediation
Exclude `node_modules` from the upload. Configure the workflow to zip only source code and leverage Azure's Oryx engine to build and install production dependencies natively on the target container by setting:
```yaml
env:
  SCM_DO_BUILD_DURING_DEPLOYMENT: true
```

---

## 5. Stale Deployment Script fallbacks

### Location
* **File:** [deploy-frontend-vercel.sh](file:///c:/Harsith_Dev/Memora/scripts/deploy-frontend-vercel.sh#L6)

### The Bug
Running the local deployment script forces alias mapping to a legacy, deprecated domain unless overridden with parameters.

### Root Cause
At line 6, the fallback is set to `memoraapp.vercel.app`:
```bash
ALIAS_URL="${1:-memoraapp.vercel.app}"
```
This overrides the active deployment configuration and can map live production routes to deprecated project locations if run without explicit command arguments.

### Remediation
Update the fallback configuration to `memyapp.vercel.app`.
