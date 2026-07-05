CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  company TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_email TEXT,
  created_by_name TEXT,
  updated_by_email TEXT,
  updated_by_name TEXT
);

-- Tables above may already exist from before auth was added, so the audit
-- columns are added separately rather than only in the CREATE TABLE - this
-- runs safely on every deploy either way.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS created_by_email TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS created_by_name TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS updated_by_email TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS updated_by_name TEXT;
-- Free-text mailing address (multi-line), printed on the invoice's
-- "Client's details" block - not normalized into street/city/state since
-- nothing else here needs to query on address parts individually.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS address TEXT;

CREATE TABLE IF NOT EXISTS estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent')),
  discount_type TEXT NOT NULL DEFAULT 'percent' CHECK (discount_type IN ('flat', 'percent')),
  discount_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
  tax_type TEXT NOT NULL DEFAULT 'percent' CHECK (tax_type IN ('flat', 'percent')),
  tax_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_email TEXT,
  created_by_name TEXT,
  updated_by_email TEXT,
  updated_by_name TEXT
);

ALTER TABLE estimates ADD COLUMN IF NOT EXISTS created_by_email TEXT;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS created_by_name TEXT;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS updated_by_email TEXT;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS updated_by_name TEXT;
-- Optional - the printable invoice shows this when set, otherwise omits the line.
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS due_date DATE;

CREATE TABLE IF NOT EXISTS line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(12, 2) NOT NULL DEFAULT 1,
  rate NUMERIC(12, 2) NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_estimates_client_id ON estimates(client_id);
CREATE INDEX IF NOT EXISTS idx_estimates_status ON estimates(status);
CREATE INDEX IF NOT EXISTS idx_line_items_estimate_id ON line_items(estimate_id);

-- Append-only history of who did what. Rows are never updated or deleted -
-- if that's ever needed, it means the audit trail failed at its one job.
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('client', 'estimate')),
  entity_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  actor_email TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);

-- Per-field before/after values for "update" rows, so the History panel can
-- show what actually changed rather than just "update - so-and-so".
-- Shape: [{ "field": "Title", "oldValue": "...", "newValue": "..." }, ...]
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS changes JSONB;

-- One row per person who has ever signed in. Role is set once at first
-- sign-in (see auth.ts for the "first user ever becomes admin" bootstrap
-- rule) and only changes after that via the admin users page - it is
-- deliberately NOT re-derived from the Google token on every login.
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'dev', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The toolshed's app registry. min_role gates which roles can open an app
-- once it's active; status gates whether it's buildable/clickable at all
-- regardless of role (a "coming soon" tile has no route to send anyone to).
CREATE TABLE IF NOT EXISTS apps (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'coming_soon' CHECK (status IN ('active', 'coming_soon')),
  min_role TEXT NOT NULL DEFAULT 'user' CHECK (min_role IN ('user', 'dev', 'admin')),
  sort_order INTEGER NOT NULL DEFAULT 0
);

INSERT INTO apps (slug, name, description, status, min_role, sort_order) VALUES
  ('quoted', 'Quot:D', 'Create and manage client cost estimates', 'active', 'user', 0),
  ('tool-2', 'Coming Soon', 'Another Boncom tool, in the works', 'coming_soon', 'user', 1),
  ('tool-3', 'Coming Soon', 'Another Boncom tool, in the works', 'coming_soon', 'user', 2)
ON CONFLICT (slug) DO NOTHING;

-- Rename pass for databases seeded before the tool was christened Quot:D -
-- the ON CONFLICT DO NOTHING above never touches existing rows. migrate.ts
-- replays this whole file on deploy, so the rename lands automatically.
UPDATE apps SET name = 'Quot:D' WHERE slug = 'quoted' AND name IN ('Quoted', 'Q:D');

