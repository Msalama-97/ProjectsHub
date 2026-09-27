-- ProjectHub initial schema

CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE projects (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  code          TEXT,
  client        TEXT,
  description   TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'opportunity'
                CHECK (status IN ('opportunity','active','on_hold','completed','lost','cancelled')),
  currency      TEXT NOT NULL DEFAULT 'USD',
  contract_value NUMERIC(14,2),          -- total agreed value / budget (or estimated value for opportunities)
  probability   INTEGER CHECK (probability BETWEEN 0 AND 100), -- win chance for opportunities
  start_date    DATE,
  end_date      DATE,
  owner_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  jira_url      TEXT,
  color         TEXT NOT NULL DEFAULT '#6366f1',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE people (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  title         TEXT,
  email         TEXT,
  monthly_salary NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency      TEXT NOT NULL DEFAULT 'USD',
  employment_type TEXT NOT NULL DEFAULT 'full_time'
                CHECK (employment_type IN ('full_time','part_time','contractor','freelancer')),
  active        BOOLEAN NOT NULL DEFAULT true,
  notes         TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE allocations (
  id            SERIAL PRIMARY KEY,
  project_id    INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  person_id     INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  role          TEXT,
  percent       INTEGER NOT NULL DEFAULT 100 CHECK (percent BETWEEN 0 AND 100),
  monthly_cost  NUMERIC(14,2) NOT NULL DEFAULT 0, -- cost charged to the project per month, in project currency
  start_date    DATE,
  end_date      DATE,
  notes         TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE subscriptions (
  id            SERIAL PRIMARY KEY,
  project_id    INTEGER REFERENCES projects(id) ON DELETE CASCADE, -- NULL = company-wide / overall
  name          TEXT NOT NULL,
  vendor        TEXT,
  amount        NUMERIC(14,2) NOT NULL,
  currency      TEXT NOT NULL DEFAULT 'USD',
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly','quarterly','yearly','one_time')),
  start_date    DATE,
  next_renewal  DATE,
  active        BOOLEAN NOT NULL DEFAULT true,
  notes         TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE expenses (
  id            SERIAL PRIMARY KEY,
  project_id    INTEGER REFERENCES projects(id) ON DELETE CASCADE, -- NULL = overall / company expense
  category      TEXT NOT NULL DEFAULT 'other'
                CHECK (category IN ('salary','subscription','contractor','software','hardware','travel','marketing','office','tax','other')),
  description   TEXT NOT NULL,
  amount        NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  currency      TEXT NOT NULL DEFAULT 'USD',
  date          DATE NOT NULL DEFAULT CURRENT_DATE,
  person_id     INTEGER REFERENCES people(id) ON DELETE SET NULL,
  subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL,
  allocation_id INTEGER REFERENCES allocations(id) ON DELETE SET NULL,
  period        TEXT, -- e.g. '2026-09' for payroll runs
  notes         TEXT NOT NULL DEFAULT '',
  created_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX expenses_payroll_unique ON expenses(allocation_id, period) WHERE allocation_id IS NOT NULL AND period IS NOT NULL;
CREATE INDEX expenses_project_idx ON expenses(project_id);
CREATE INDEX expenses_date_idx ON expenses(date);

CREATE TABLE incomes (
  id            SERIAL PRIMARY KEY,
  project_id    INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  description   TEXT NOT NULL,
  reference     TEXT,           -- invoice number, PO, etc.
  amount        NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  status        TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received','expected')),
  date          DATE NOT NULL DEFAULT CURRENT_DATE,
  notes         TEXT NOT NULL DEFAULT '',
  created_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX incomes_project_idx ON incomes(project_id);

CREATE TABLE documents (
  id            SERIAL PRIMARY KEY,
  project_id    INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('file','link')),
  url           TEXT,
  file_key      TEXT,
  file_name     TEXT,
  mime_type     TEXT,
  size_bytes    BIGINT,
  category      TEXT NOT NULL DEFAULT 'general',
  uploaded_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE project_notes (
  id            SERIAL PRIMARY KEY,
  project_id    INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  body          TEXT NOT NULL,
  author_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
