# Comprehensive Implementation Task Checklist

This document contains a step-by-step checklist of tasks that need to be performed to address current errors, complete integration gaps, and implement core SEO and automation improvements.

---

## Task 1: Create Static Public Files

Currently, the `memora-frontend` folder does not contain a `public` directory. A public directory needs to be created to serve static resources directly from the root of your domain.

### 1.1 Create the directory structure:
* Target Directory: `c:\Harsith_Dev\Memora\memora-frontend\public\`

### 1.2 Create `sitemap.xml`
Create `memora-frontend/public/sitemap.xml` with the following content:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Main Landing Page -->
  <url>
    <loc>https://memyapp.vercel.app/</loc>
    <lastmod>2026-07-10</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <!-- Authentication -->
  <url>
    <loc>https://memyapp.vercel.app/login</loc>
    <lastmod>2026-07-10</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://memyapp.vercel.app/signup</loc>
    <lastmod>2026-07-10</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <!-- Pricing -->
  <url>
    <loc>https://memyapp.vercel.app/pricing</loc>
    <lastmod>2026-07-10</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <!-- Public Documentation -->
  <url>
    <loc>https://memyapp.vercel.app/docs</loc>
    <lastmod>2026-07-10</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
</urlset>
```

### 1.3 Create `robots.txt`
Create `memora-frontend/public/robots.txt` with the following content:
```text
User-agent: *
Allow: /
Allow: /docs
Allow: /pricing
Disallow: /dashboard
Disallow: /graph
Disallow: /topics
Disallow: /doctags
Disallow: /journal
Disallow: /chronicle
Disallow: /focus
Disallow: /profile
Disallow: /profile_v2
Disallow: /analytics
Disallow: /mindmaps
Disallow: /listener
Disallow: /flashcards
Disallow: /achievements
Disallow: /evaluation

Sitemap: https://memyapp.vercel.app/sitemap.xml
```

### 1.4 Restore `manifest.json` and PWA Assets
Create `memora-frontend/public/manifest.json` with the following baseline PWA properties to match the visual design guidelines:
```json
{
  "short_name": "Memy",
  "name": "Memy - Spaced Repetition Workspace",
  "icons": [
    {
      "src": "favicon.ico",
      "sizes": "64x64 32x32 24x24 16x16",
      "type": "image/x-icon"
    }
  ],
  "start_url": "/dashboard",
  "background_color": "#000000",
  "theme_color": "#000000",
  "display": "standalone",
  "orientation": "portrait"
}
```

---

## Task 2: Correct GitHub Action Workflow Configurations

### 2.1 Update Frontend Vercel Deploy Action
Modify [.github/workflows/deploy-frontend-vercel.yml](file:///c:/Harsith_Dev/Memora/.github/workflows/deploy-frontend-vercel.yml):

1. **Add Push Trigger**: Configure automatic deployment to Vercel on pushes to the `main` branch:
   ```yaml
   on:
     push:
       branches:
         - main
       paths:
         - memora-frontend/**
         - .github/workflows/deploy-frontend-vercel.yml
     workflow_dispatch:
       inputs:
         alias_domain:
           description: 'Target alias for this deployment'
           required: true
           default: 'memyapp.vercel.app'
           type: string
   ```
2. **Expose Missing Environment Variables to Pull Step**: Update the "Pull Vercel Environment Information" step to:
   ```yaml
   - name: Pull Vercel Environment Information
     working-directory: memora-frontend
     env:
       VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
       VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
       VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
     run: vercel pull --yes --environment=production --token "$VERCEL_TOKEN"
   ```
3. **Synchronize Deployment Aliases**: Change the default inputs and guards to validate `memyapp.vercel.app` instead of legacy domains.

### 2.2 Optimize Backend Azure Deploy Action
Modify [.github/workflows/deploy-backend-azure.yml](file:///c:/Harsith_Dev/Memora/.github/workflows/deploy-backend-azure.yml):
1. Configure zip packaging to exclude `node_modules`. Instead, upload only raw source code.
2. In the deployment step settings, verify Oryx build is enabled:
   ```yaml
   env:
     SCM_DO_BUILD_DURING_DEPLOYMENT: true
   ```

---

## Task 3: Update Hardcoded Web App Domain Targets

### 3.1 Update `SeoManager.jsx`
Modify [SeoManager.jsx](file:///c:/Harsith_Dev/Memora/memora-frontend/src/components/SeoManager.jsx#L5):
```javascript
// Change
const SITE_URL = 'https://memy.vercel.app';
// To
const SITE_URL = 'https://memyapp.vercel.app';
```

### 3.2 Update `index.html`
Modify [index.html](file:///c:/Harsith_Dev/Memora/memora-frontend/index.html#L17):
```html
<!-- Change -->
<link rel="canonical" href="https://memy.vercel.app/" />
<!-- To -->
<link rel="canonical" href="https://memyapp.vercel.app/" />
```
Also update Twitter card site/domain URLs if present.

---

## Task 4: Fix Stale Local Deploy Scripts

Modify [deploy-frontend-vercel.sh](file:///c:/Harsith_Dev/Memora/scripts/deploy-frontend-vercel.sh#L6):
```bash
# Change
ALIAS_URL="${1:-memoraapp.vercel.app}"
# To
ALIAS_URL="${1:-memyapp.vercel.app}"
```
