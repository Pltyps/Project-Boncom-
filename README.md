# Quoted

A small web app for building and tracking client cost estimates, built for Boncom's take-home
exercise. The brief: replace a spreadsheet workflow where line items get copied by hand and tax
math gets rechecked every time.

## What it does

- Create an estimate for a client, add line items (description, qty, rate), and watch the totals
  update as you type.
- Apply a discount and a tax rate, each as either a flat amount or a percentage. Discount is
  applied to the subtotal first, then tax is calculated on what's left — so a client never gets
  taxed on money they didn't end up owing.
- Mark an estimate draft or sent, and come back to it later from the dashboard.
- Search and filter past estimates by client name, title, or status.
- Duplicate an estimate to reuse as a starting point for a new one.
- Print or share a clean, read-only view of an estimate (browser print dialog, stripped of all
  editing chrome).

## Stack and why

- **Frontend:** React + TypeScript on Vite. No CSS framework — a small hand-written design system
  (`frontend/src/index.css`) keeps the bundle light and the look consistent.
- **Backend:** Node + Express + TypeScript, talking to Postgres through the `pg` driver directly.
  No ORM — the queries are simple enough that an ORM would add a layer of indirection without
  buying much, and hand-written parameterized SQL is easy to audit for injection risk.
- **Database:** Postgres (Neon in production, since it has a real free tier and is wire-compatible
  with anything Postgres). Money fields are `NUMERIC`, not `FLOAT` — the totals math runs through
  `decimal.js` on the backend so rounding never drifts.
- **No auth in v1.** This is a single-user tool; a login screen would be scope creep for what the
  brief asks for. Google OAuth is scaffolded as a stretch goal, not built.

## Running it locally

You'll need Node 22+ and a Postgres instance (local or Neon).

```bash
# Backend
cd backend
cp .env.example .env        # point DATABASE_URL at your Postgres instance
npm install
npm run migrate             # creates clients / estimates / line_items tables
npm run dev                 # http://localhost:4000

# Frontend, in a second terminal
cd frontend
cp .env.example .env
npm install
npm run dev                 # http://localhost:5173
```

## Deploying

- **Backend → Render:** `render.yaml` at the repo root defines a free-tier web service rooted at
  `backend/`. Set `DATABASE_URL` (your Neon connection string) and `CORS_ORIGIN` (your deployed
  frontend URL) in Render's dashboard — they're marked `sync: false` so they aren't committed.
- **Frontend → Vercel:** point a Vercel project at `frontend/` and set `VITE_API_URL` to your
  Render backend's URL plus `/api`. `frontend/vercel.json` handles SPA routing so refreshing on
  `/estimates/:id` doesn't 404.

## What's built vs. skipped

Built: everything in the "Must" tier of the brief, plus most of the "Should" tier (reusable client
list, duplicate-as-template, search/filter, printable view). Skipped: Google OAuth gate (stretch
goal, no time pressure to add it since this is single-user), per-line-item tax overrides, dark
mode, version history — all explicitly lower priority.

## With more time

Line-item drag-to-reorder, a proper "sent" email flow instead of just a status flag, and version
history on estimates (right now, editing overwrites — there's no audit trail of what a client was
originally quoted).
