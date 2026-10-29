# Publishing ReUseHub (GitHub + Netlify + backend)

## How the pieces fit

```
Browser --> Netlify (HTML/CSS/JS from /public)
              \--/api/*--> Backend on Render (Node/Express) --> Cloud MySQL
```

Netlify cannot run Express or MySQL, so the backend and database need their own free hosting.
Free-plan limits change often, so check each provider's current free tier before you rely on it.

## Option A (simplest to share): deploy the WHOLE app on Render, skip Netlify

Express already serves the website pages, so one Render service gives you one shareable link.
Follow Step 1 (GitHub), Step 2 (database) and Step 3 (backend) below, and share the Render URL.

## Step 1: Put the code on GitHub

1. Create an account at github.com, then click **New repository** (name: `reusehub`, keep it Public or Private).
   Do NOT tick "Add a README".
2. In the VS Code terminal, inside the project folder (the one with `package.json`):
   ```
   git init
   git add .
   git status
   ```
   Check that `.env` and `node_modules` are NOT in the list (they are blocked by `.gitignore`).
   If `.env` appears, stop and tell your team: it holds passwords and must never be uploaded.
3. Then:
   ```
   git commit -m "ReUseHub first version"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/reusehub.git
   git push -u origin main
   ```
   (Install Git from git-scm.com first if `git` is not recognised.)
4. If you ever pushed `.env` by mistake, change your MySQL and admin passwords and `SESSION_SECRET` immediately.

## Step 2: Get a cloud MySQL database

Use any MySQL-compatible cloud database with a free plan (for example Aiven for MySQL, TiDB Cloud, or Railway).
From the dashboard note: host, port, username, password and database name.

Run the one-time setup from YOUR laptop against the cloud database. In `.env` set:
```
DB_HOST=<host from the provider>
DB_PORT=<port from the provider>
DB_USER=<user>
DB_PASSWORD=<password>
DB_NAME=<database name>
DB_SSL=true
ADMIN_EMAIL=<your admin email>
ADMIN_PASSWORD=<a strong password>
SEED_DEMO=false
```
Then run `npm run setup`. Use `SEED_DEMO=false` for a public site, because the demo students share a publicly known password.
Afterwards put your local `.env` back to your local MySQL values.

If setup says the certificate is not trusted, add `DB_SSL_ALLOW_UNVERIFIED=true` (demo use only).

## Step 3: Deploy the backend on Render

1. At render.com choose **New, Web Service**, connect your GitHub repo.
2. Settings: Runtime **Node**, Build command `npm install`, Start command `npm start`.
3. Under **Environment**, add these variables:
   `NODE_ENV=production`, `SESSION_SECRET` (long random text), `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL=true`.
   (Do not add ADMIN_PASSWORD here; setup already created the admin.)
4. Deploy. Open `https://YOUR-SERVICE.onrender.com/api/health`; it should show `{"status":"ok",...}`.
5. If you are following Option A, you are done: share the Render URL.

Free Render services go to sleep when idle, so the first visit can take about a minute. Sessions are stored in memory, so users are logged out whenever the service restarts or sleeps.

## Step 4 (optional): Netlify for the frontend

Netlify only shows the pages. Items, login and requests work only after the backend from Step 3 is live.

1. Open `public/_redirects` and replace `YOUR-BACKEND-URL` with your Render address (without `https://`).
   Example: `/api/*  https://reusehub-api.onrender.com/api/:splat  200!`
2. Deploy to Netlify in either way:
   - **Drag and drop:** at app.netlify.com open **Sites**, then drag the **`public`** folder onto the deploy area.
   - **From GitHub:** **Add new site, Import an existing project**, pick the repo. `netlify.toml` already sets the publish folder to `public`.
3. Open the Netlify link and test: home page items, register, login, send a request.

Netlify serves `admin.html` as a normal file; the admin page redirects non-admins away and every admin API call is still checked on the server.

## Before sharing the link widely

This is a student prototype: emails are not verified, sessions are in memory, and there is no rate limiting beyond login attempts. Share it for the demo and testing, not as a real public marketplace.
