# Boncom Toolshed

## App Summary

Boncom Toolshed is a web application that replaces a spreadsheet-based workflow for building
client cost estimates. The problem it solves is that staff shouldn't have to hand-copy line items
between quotes and manually recheck discount/tax math every time a number changes. The primary
user is a Boncom employee who signs in with their Google account and needs to create, edit, or
print a cost estimate for a client. A user signs in, picks or creates a client, builds an estimate
out of line items, applies a discount and a tax rate, and gets a clean printable/shareable view —
every change is attributed to the signed-in user and recorded in an append-only audit log. The
toolshed itself is designed to hold more than one internal tool: **Quot:D** (the estimate builder)
is the first and currently only working one; other tiles on the home dashboard are placeholders
for tools still to come. Role-based access (`user` / `dev` / `admin`) and an optional email
allowlist mean the app can be handed to a small, specific team rather than being an open URL.

## Tech Stack

- **Frontend:** React 19 + TypeScript on Vite 8, React Router, no CSS framework — a small
  hand-written design system (`frontend/src/index.css`) keeps the bundle light
- **Frontend tooling:** npm for dependency management, `oxlint` for linting
- **Backend:** Node.js with Express 4 and TypeScript (CommonJS), no ORM — hand-written
  parameterized SQL via the `pg` driver
- **Database:** PostgreSQL (Neon in production), accessed through the `pg` driver; money fields
  are `NUMERIC` and totals math runs through `decimal.js` so rounding never drifts
- **Authentication:** Google Identity Services on the frontend (plain script tag, no SDK
  dependency) hands back a Google ID token; the backend verifies it with `google-auth-library`
  against its own Client ID and issues a signed session token via `jsonwebtoken`
- **Validation:** `zod` schemas on every write endpoint
- **PDF/print export:** `html2canvas` + `jspdf` on the frontend for the printable estimate view
- **Deployment:** two separate Vercel projects from one GitHub repo — `backend/` as a single
  Vercel serverless function (`backend/api/index.ts` wrapping the Express app, routed by
  `backend/vercel.json`), `frontend/` as a static Vite build with SPA rewrites

## Architecture Diagram

```
[ Browser ]
   │  Google Identity Services (ID token)
   ▼
[ Frontend — React/Vite, Vercel static ]
   │  fetch, Bearer <session JWT>
   ▼
[ Backend — Express, Vercel serverless function ]
   │  parameterized SQL (pg)
   ▼
[ PostgreSQL — Neon ]
```

## Prerequisites

Install the following before running the project locally:

- **Node.js 22+ and npm**
  Official install guide: https://nodejs.org/en/download
  Verify:
  ```
  node --version
  npm --version
  ```
- **PostgreSQL** (local instance, or a free Neon project — wire-compatible with any Postgres)
  Official install guide: https://www.postgresql.org/download/
  Neon: https://neon.tech
- **A Google Cloud OAuth 2.0 Client ID** (Web application type)
  Official docs: https://developers.google.com/identity/gsi/web/guides/overview

## Installation and Setup

1. Clone the repository and move into it.
   ```
   git clone https://github.com/Pltyps/Project-Boncom-.git
   cd Project-Boncom-
   ```
2. Install backend dependencies.
   ```
   cd backend
   npm install
   ```
3. Install frontend dependencies.
   ```
   cd ../frontend
   npm install
   ```
4. Create a Postgres database for the app (local example):
   ```
   createdb boncom_toolshed
   ```
   Or create a free database on [Neon](https://neon.tech) and copy its connection string.
5. Create `backend/.env` from `backend/.env.example` and fill in real values:
   ```
   DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
   PORT=4000
   CORS_ORIGIN=http://localhost:5173
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   SESSION_SECRET=any-long-random-string
   ALLOWED_EMAILS=you@example.com,@yourcompany.com
   ```
6. Run the schema/migration script — this creates every table (idempotent, safe to re-run) and
   seeds the app registry. No separate `seed.sql`; the first user to sign in becomes `admin`
   automatically, everyone after that starts as `user`.
   ```
   cd ../backend
   npm run migrate
   ```
7. Create `frontend/.env` from `frontend/.env.example`:
   ```
   VITE_API_URL=http://localhost:4000/api
   VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   ```
8. Configure Google OAuth. On the Web Application OAuth Client, add:
   ```
   Authorized JavaScript origin: http://localhost:5173
   ```
9. If deploying to Vercel, `backend/vercel.json` and `frontend/vercel.json` are already set up as
   two independent projects — see **Deploying** below.

## Running the Application

The frontend and backend run as two separate processes locally (each has its own dev server).

1. Start the backend:
   ```
   cd backend
   npm run dev          # http://localhost:4000
   ```
2. In a second terminal, start the frontend:
   ```
   cd frontend
   npm run dev          # http://localhost:5173
   ```
3. Open the app in your browser at:
   ```
   http://localhost:5173
   ```
4. Sign in with Google, open **Quot:D** from the home dashboard, and create a client and an
   estimate.

## Verifying the Vertical Slice

1. Start both servers locally and open `http://localhost:5173`.
2. Sign in with Google.
3. From the Quot:D dashboard, create a client, then create a new estimate for that client.
4. Add a few line items (description, quantity, rate), set a discount and a tax rate, and confirm
   the totals update live.
5. Save the estimate as a draft.
6. Confirm the write in Postgres:
   ```sql
   SELECT id, title, status, client_id FROM estimates ORDER BY created_at DESC LIMIT 5;
   SELECT id, description, quantity, rate FROM line_items ORDER BY position LIMIT 10;
   SELECT entity_type, action, actor_email FROM audit_log ORDER BY created_at DESC LIMIT 5;
   ```
7. Refresh the browser or navigate back to the dashboard, then reopen the same estimate.
8. Confirm the line items, totals, and audit history still render after reload — showing the data
   persisted to PostgreSQL rather than only living in browser/React state.

## Deploying

Both frontend and backend deploy to Vercel as **separate projects** from the same repo.

- **Backend:** Root Directory must be set to `backend` (not `./`) in Project Settings — this repo
  has no root-level `package.json`. Env vars: `DATABASE_URL`, `CORS_ORIGIN` (the frontend's deployed
  URL), `GOOGLE_CLIENT_ID`, `SESSION_SECRET`, optionally `ALLOWED_EMAILS`.
- **Frontend:** Root Directory `frontend`. Env vars: `VITE_API_URL` (backend URL + `/api`),
  `VITE_GOOGLE_CLIENT_ID`.
- Add both deployed URLs as Authorized JavaScript origins on the Google OAuth Client.

## Live Version

- Frontend: https://frontend-phi-lemon-83.vercel.app
- Backend API: https://backend-opal-three-58.vercel.app

## Notes

- `backend/src/db/migrate.ts` re-runs the entire `schema.sql` file on every deploy; every
  statement in it uses `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`, so it's safe to
  run repeatedly without a separate migration-tracking table.
- The backend is a single Vercel serverless function (`backend/api/index.ts` wrapping the whole
  Express app) rather than one function per route — simpler to reason about, and the connection
  pool is capped at 1 per instance since Neon's pooled endpoint handles concurrency across
  instances.
- `ALLOWED_EMAILS` supports both exact addresses and whole-domain entries (e.g. `@boncom.com`), so
  a company-wide allowlist doesn't need every address listed individually.
