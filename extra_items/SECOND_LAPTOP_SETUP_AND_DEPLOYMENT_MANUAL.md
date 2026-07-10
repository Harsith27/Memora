# Memora Second Laptop Setup and Deployment Manual

This is the checklist to use when you clone Memora onto another laptop and want to run or deploy it from there.

## 1) What to copy from the repo

Do not copy `node_modules`, `dist`, `.vercel`, or any real `.env` files.

What you should copy or recreate:

- The repository itself.
- `memora-backend/.env` created from `memora-backend/.env.example`.
- `memora-frontend/.env` created from `memora-frontend/.env.example` if you need a custom API URL.
- Any local MongoDB data only if you want the same local database content on the second laptop.

## 2) Required software on the second laptop

- Git.
- Node.js 20 or newer.
- npm.
- MongoDB locally, or a MongoDB Atlas connection string.
- Azure CLI, if you want to deploy the backend from that laptop.
- Vercel CLI, if you want to deploy the frontend from that laptop.

## 3) Local environment files

### Backend: `memora-backend/.env`

Start from `memora-backend/.env.example` and fill in the real values.

Required for local development:

- `PORT=3001`
- `NODE_ENV=development`
- `MONGODB_URI=mongodb://localhost:27017/memora` or your Atlas URI
- `JWT_SECRET=<strong secret>`
- `JWT_REFRESH_SECRET=<strong secret>`
- `FRONTEND_URL=http://localhost:5173`
- `FILE_STORAGE_PROVIDER=local`

Optional but used by some features:

- `AI_PROVIDER`
- `GEMINI_API_KEY` or `GROQ_API_KEY`
- `SMTP_*` values if you want email features
- `AZURE_STORAGE_CONNECTION_STRING` and `AZURE_STORAGE_CONTAINER_NAME` only if you want Azure Blob storage

### Frontend: `memora-frontend/.env`

For local development, this can usually stay as:

- `VITE_API_URL=/api`

If you want the frontend to call a deployed backend directly, use:

- `VITE_API_URL=https://<your-backend-app>.azurewebsites.net/api`

## 4) Local run steps

1. Clone the repo.
2. Open the repo in VS Code.
3. Create the backend `.env` file.
4. Create the frontend `.env` file if needed.
5. Run `npm install` in `memora-backend`.
6. Run `npm install` in `memora-frontend`.
7. Start MongoDB locally if you are not using Atlas.
8. Start the backend with `npm run dev` in `memora-backend`.
9. Start the frontend with `npm run dev` in `memora-frontend`.

## 5) When to run `az login`

Run `az login` on the second laptop only if you want to manage or deploy the Azure backend from that laptop.

Use Azure CLI after login for things like:

- checking the App Service
- updating app settings
- deploying the backend with the deployment script

Typical flow:

```bash
az login
az account set --subscription <your-subscription-id>
bash scripts/deploy-backend-azure.sh memora-prod-rg memora-api-04021453
```

If you are only running the app locally, you do not need `az login`.

## 6) When to run `vercel login`

Run `vercel login` on the second laptop only if you want to deploy the frontend from that laptop.

Typical flow:

```bash
vercel login
bash scripts/deploy-frontend-vercel.sh memyapp.vercel.app
```

If you are only running the app locally, you do not need `vercel login`.

## 7) Deployment flow from the second laptop

### Frontend deployment

1. Log in with `vercel login`.
2. From the repo root, run the frontend deploy script.
3. Wait for the preview deployment to finish.
4. Confirm the alias points to `memyapp.vercel.app`.

### Backend deployment

1. Log in with `az login`.
2. Make sure the subscription is set correctly.
3. Confirm the required backend app settings are present in Azure.
4. Run the backend deploy script.
5. Check `https://<backend-app>.azurewebsites.net/api/health`.

## 8) What to send in Teams

Send only non-secret setup notes in Teams.

Good to send:

- repo link
- which commands to run
- which env keys are required
- the backend URL and frontend URL
- which laptop should be used for deployment

Do not send:

- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `MONGODB_URI`
- Azure storage keys
- SMTP passwords
- Vercel tokens
- any real `.env` file contents

## 9) Quick checklist for a fresh laptop

- Git installed.
- Node.js installed.
- MongoDB or Atlas available.
- `.env` files created from the examples.
- `npm install` done in both apps.
- `az login` only if doing Azure backend work.
- `vercel login` only if doing frontend deploy work.
- Local app starts successfully.

## 10) Fast reference commands

```bash
git clone <repo-url>
cd Memora
cd memora-backend && npm install
cd ../memora-frontend && npm install
```

Local development:

```bash
# terminal 1
cd memora-backend
npm run dev

# terminal 2
cd memora-frontend
npm run dev
```

Deployment:

```bash
az login
vercel login
```

That is enough for a second laptop to run the project and, if needed, deploy it.