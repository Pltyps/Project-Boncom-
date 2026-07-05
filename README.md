# Boncom Toolshed

A small internal tools launcher, built for Boncom's take-home exercise. The first (and currently
only working) tool is **Quoted** — replaces a spreadsheet workflow for client cost estimates where
line items got copied by hand and tax math got rechecked every time. Other tiles on the home
screen are placeholders for future internal tools.

## What Quoted does

- Create an estimate for a client, add line items (description, qty, rate), and watch the totals
  update as you type.
- Apply a discount and a tax rate, each as either a flat amount or a percentage. Discount is
  applied to the subtotal first, then tax is calculated on what's left — so a client never gets
  taxed on money they didn't end up owing. Each figure has an info tooltip showing the actual
  formula and numbers used.
- Mark an estimate draft or sent, and come back to it later from the dashboard.
- Search and filter past estimates by client name, title, or status.
- Duplicate an estimate to reuse as a starting point for a new one.
- Print or share a clean, read-only view of an estimate.
- Every create/update/delete is attributed to the signed-in user and recorded in an append-only
  audit log, visible per-estimate in the editor.

## Access model

Sign-in is Google OAuth only — no separate account system. Three roles: **user**, **dev**,
**admin**. The first person ever to sign in becomes admin automatically (so there's always someone
who can grant access without a manual DB edit); everyone after that starts as `user`. Admins manage
roles from the Users page. Each toolshed app has a `min_role` — Quoted is open to everyone signed
in; a future app could be restricted to `dev`/`admin` by raising that one column, no code change.
An optional `ALLOWED_EMAILS` env var can restrict sign-in to a specific list entirely.

## Stack and why

- **Frontend:** React + TypeScript on Vite. No CSS framework — a small hand-written design system
  (`frontend/src/index.css`) keeps the bundle light and the look consistent.
- **Backend:** Node + Express + TypeScript, talking to Postgres through the `pg` driver directly.
  No ORM — the queries are simple enough that an ORM would add a layer of indirection without
  buying much, and hand-written parameterized SQL is easy to audit for injection risk. Deployed as
  a single Vercel serverless function wrapping the Express app, rather than Render — Render's free
  tier sleeps after inactivity (30-60s cold start on the next request); Vercel functions don't hold
  a persistent process to sleep.
- **Database:** Postgres (Neon in production — real free tier, wire-compatible with any Postgres).
  Money fields are `NUMERIC`, not `FLOAT` — totals math runs through `decimal.js` on the backend so
  rounding never drifts.
- **Auth:** Google Identity Services on the frontend (a plain script tag, no SDK dependency) hands
  back a Google ID token; the backend verifies it against our Client ID and issues its own signed
  session JWT, so the frontend isn't re-running the Google flow on every request.

## Running it locally

You'll need Node 22+, a Postgres instance (local or Neon), and a Google Cloud OAuth Client ID
(Web application type; add `http://localhost:5173` as an authorized JavaScript origin).

```bash
# Backend
cd backend
cp .env.example .env        # fill in DATABASE_URL, GOOGLE_CLIENT_ID, SESSION_SECRET
npm install
npm run migrate             # creates all tables, seeds the apps registry
npm run dev                 # http://localhost:4000

# Frontend, in a second terminal
cd frontend
cp .env.example .env        # fill in VITE_GOOGLE_CLIENT_ID
npm install
npm run dev                 # http://localhost:5173
```

## Deploying

Both frontend and backend deploy to Vercel as separate projects.

- **Backend:** root directory `backend/`. `backend/api/index.ts` + `backend/vercel.json`'s
  catch-all rewrite route every request to that one function. Env vars: `DATABASE_URL`,
  `CORS_ORIGIN` (your frontend's URL), `GOOGLE_CLIENT_ID`, `SESSION_SECRET`, optionally
  `ALLOWED_EMAILS`.
- **Frontend:** root directory `frontend/`. Env vars: `VITE_API_URL` (backend URL + `/api`),
  `VITE_GOOGLE_CLIENT_ID`. `frontend/vercel.json` handles SPA routing so refreshing on
  `/quoted/estimates/:id` doesn't 404.
- Add both deployed URLs as authorized JavaScript origins on the Google OAuth Client.

## What's built vs. skipped

Built: everything in the brief's "Must" tier, plus most of the "Should" tier (reusable client
list, duplicate-as-template, search/filter, printable view), plus Google OAuth + role-based access
control + an audit trail — further than the brief asked for, added once the app needed to hold
real client data behind something more than an open URL. Skipped: per-app fine-grained grants
(currently role-based only, not per-user-per-app), per-line-item tax overrides, dark mode.

## With more time

Line-item drag-to-reorder, a proper "sent" email flow instead of just a status flag, per-user-per-
app access grants (independent of role) for when the toolshed has more than one working tool, and
a tax-rate reference table by jurisdiction (looked into pulling this from official government
sources — there's no single authoritative free API across jurisdictions, so it'd need to be a
maintained reference dataset with cited sources rather than a live feed).
