# ReUseHub - Exchange More, Waste Less

A college item reuse and exchange platform (DevFusion hackathon project).
Stack: HTML/CSS/vanilla JS, Node.js + Express, MySQL (mysql2), bcryptjs, express-session.

## What is included

| Area | Features |
|---|---|
| Guests | Home, browse, search + filter (category, condition, listing type), item details, register, login |
| Students | Login/logout, edit profile and password, add/edit/remove own listings, send requests, accept/reject/cancel/complete requests, chat per request, report listings |
| Admin | Separate login, dashboard with stats, users (deactivate/reactivate), listings (remove), reports (dismiss/resolve/remove item), all requests |
| Security | bcrypt password hashes, HttpOnly session cookies, 2-hour expiry, session regenerated on login, CSRF token on every change, parameterized SQL, server-side role checks, login attempt limiter, CSP header, output escaping |

## Honest list of differences from the original brief

- **Email verification is not implemented.** It needs a real mail account to test, and an untested feature would be worse than none. Accounts are not verified as college students.
- **Chat uses polling, not Socket.IO.** The chat panel refreshes every 5 seconds while open. It works with no extra setup and is easy to explain. Real-time chat is listed as a future improvement.
- **`bcryptjs` is used instead of `bcrypt`.** Same hashing algorithm (`$2a$` hashes), but it installs on Windows without a C++ compiler.
- **Sessions live in server memory.** Everyone is logged out when you restart the server. Fine for a demo, not for production.
- **Route files contain their handlers** (no separate controllers folder) to keep the project small enough for beginners.
- **I could not run this against a real MySQL server while building it.** The JavaScript was syntax-checked and the validation logic was tested, but the first full run happens on your laptop. Follow the test checklist below and tell me the exact error text if anything fails.

## Windows setup (PowerShell, VS Code)

1. Install **Node.js LTS** (nodejs.org) and **MySQL Community Server 8.x** (dev.mysql.com). Remember the MySQL root password you set. Make sure the MySQL service is running (Win + R, type `services.msc`, find "MySQL80", status Running).
2. Unzip the project, then in VS Code use **File > Open Folder** and choose the `reusehub` folder.
3. Open the terminal (**Ctrl + `**). Check the path ends in `reusehub`, then run:
   ```powershell
   npm install
   Copy-Item .env.example .env
   ```
4. Open `.env` and set:
   - `DB_PASSWORD` to your MySQL root password
   - `SESSION_SECRET` to any long random text (32+ characters)
   - `ADMIN_EMAIL` and `ADMIN_PASSWORD` to the admin login you want (minimum 8 characters, letters and numbers). The password is only read once, by the setup script. Keep `SEED_DEMO=true` for the demo data.
5. Create the database, tables, admin account and demo data:
   ```powershell
   npm run setup
   ```
   You should see "Tables are ready", "Admin account created" and "Demo data added". Running it again is safe.
6. Start the site:
   ```powershell
   npm start
   ```
7. Open **http://localhost:3000**.

If PowerShell blocks npm with a "scripts disabled" error, run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once, or switch the terminal to Command Prompt (use `copy .env.example .env` there).

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Admin | the `ADMIN_EMAIL` you put in `.env` | the `ADMIN_PASSWORD` you put in `.env` (login at `/admin-login.html`) |
| Student (sample) | asha@demo.reusehub.local | Demo@1234 |
| Student (sample) | rohan@demo.reusehub.local | Demo@1234 |
| Student (sample) | priya@demo.reusehub.local | Demo@1234 |
| Student (sample) | kabir@demo.reusehub.local | Demo@1234 |

The demo student password is public. Delete the demo users before any real use.

## Publishing online

See **DEPLOY.md** for GitHub, Render (backend + website) and Netlify (frontend) steps.

## Test checklist (do this once before the demo)

1. `http://localhost:3000/api/health` shows `{"status":"ok",...}`.
2. Home page shows 3 featured items and the impact counters. Completed exchanges should be **0**, sample listings **8**.
3. Browse: search "calculator", then filter by category Books, then click Clear.
4. Register a new student, log in, and add an item (try a negative price: it must be refused).
5. In a second browser or private window, log in as Rohan, open Asha's textbook, send a request.
6. As Asha (Requests > Incoming): chat with Rohan, Accept, then Mark as completed. The item disappears from Browse and the home page "Completed exchanges" becomes **1**.
7. As Priya, report a listing. Log in as admin: Reports tab, remove the listing, then check Overview numbers and the Users tab.
8. Try to open `http://localhost:3000/admin.html` while logged out: you should be redirected to the admin login.

## Request rules (enforced by the server)

| From | To | Who can do it |
|---|---|---|
| Pending | Accepted / Rejected | item owner |
| Pending | Cancelled | requester |
| Accepted | Completed | item owner |
| Accepted | Cancelled | owner or requester |

Completing a request makes the item unavailable and rejects other open requests for it. Removing a listing cancels its open requests.

## Project structure

```
reusehub/
  database/schema.sql        tables, keys, constraints, indexes
  scripts/setup.js           creates DB, admin account, demo data
  src/app.js                 Express app: sessions, CSRF, security headers, routes
  src/config/database.js     MySQL connection pool
  src/middleware/            auth (roles), csrf, error handling
  src/routes/                auth, profile, items, requests (+chat), reports, impact, admin
  src/services/              shared item-removal logic
  src/utils/validate.js      input validation shared by routes and setup
  public/                    HTML pages, css/, js/, assets/
```

## Who explains what (5 members)

1. **Frontend design**: `public/css/*`, `layout.js`, home and about pages. Be ready to explain the colour tokens and responsive breakpoints.
2. **Browse and item pages**: `browse.js`, `item-details.js`, `GET /api/items`. Explain how filters become SQL `WHERE` clauses with `?` placeholders.
3. **Accounts and security**: `auth.routes.js`, `auth.js`, `csrf.js`, `auth.js` middleware. Explain bcrypt hashing, sessions, CSRF and why roles are checked on the server.
4. **Listings and requests**: `add-item.js`, `requests.js`, `requests.routes.js`. Explain the status table above and the transaction used when completing a request.
5. **Database and admin**: `schema.sql`, `setup.js`, `admin.routes.js`, `impact.routes.js`. Explain the tables, foreign keys, and how impact counts separate sample data from real exchanges.

## Troubleshooting

- `ER_ACCESS_DENIED_ERROR`: wrong `DB_USER` / `DB_PASSWORD` in `.env`.
- `ECONNREFUSED`: the MySQL service is not running.
- `SESSION_SECRET is missing`: fill it in `.env`, then restart.
- `Unknown database` when starting: run `npm run setup` first.
- "Security token missing or expired": refresh the page (this happens after a server restart).
- Port busy: set `PORT=3001` in `.env`.

## Before any real deployment

Add college email verification, HTTPS, a persistent session store, rate limiting on all routes, image upload with scanning, an audit log for admin actions, and a privacy policy. This prototype is not ready for real users' data as it stands.
