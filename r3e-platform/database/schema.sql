-- ═══════════════════════════════════════════════════════════
--  R3E PLATFORM — PostgreSQL Schema v3.0
--  Compatible with Render PostgreSQL service
-- ═══════════════════════════════════════════════════════════

-- ── Drop all tables in correct dependency order ─────────────
-- (ensures a clean slate on every seed run)
DROP TABLE IF EXISTS audit_logs          CASCADE;
DROP TABLE IF EXISTS campaigns           CASCADE;
DROP TABLE IF EXISTS flyers              CASCADE;
DROP TABLE IF EXISTS working_hours       CASCADE;
DROP TABLE IF EXISTS discounts           CASCADE;
DROP TABLE IF EXISTS customers           CASCADE;
DROP TABLE IF EXISTS merchant_managers   CASCADE;
DROP TABLE IF EXISTS merchants           CASCADE;
DROP TABLE IF EXISTS user_locations      CASCADE;
DROP TABLE IF EXISTS system_users        CASCADE;
DROP TABLE IF EXISTS locations           CASCADE;

-- ── Locations ──────────────────────────────────────────────
CREATE TABLE locations (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  region     TEXT NOT NULL,
  country    TEXT NOT NULL DEFAULT 'England',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── System users ───────────────────────────────────────────
CREATE TABLE system_users (
  id            TEXT PRIMARY KEY,
  type          TEXT NOT NULL CHECK (type IN ('superadmin','admin','support')),
  first_name    TEXT NOT NULL,
  last_name     TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  phone         TEXT,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  assigned_by   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── User ↔ Location assignments ────────────────────────────
CREATE TABLE user_locations (
  user_id     TEXT NOT NULL REFERENCES system_users(id) ON DELETE CASCADE,
  location_id TEXT NOT NULL REFERENCES locations(id)    ON DELETE CASCADE,
  PRIMARY KEY (user_id, location_id)
);

-- ── Merchants ──────────────────────────────────────────────
CREATE TABLE merchants (
  id              TEXT PRIMARY KEY,
  business_name   TEXT NOT NULL,
  brand_name      TEXT NOT NULL,
  category        TEXT NOT NULL DEFAULT '',
  contact_fname   TEXT NOT NULL DEFAULT '',
  contact_lname   TEXT NOT NULL DEFAULT '',
  email           TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  phone           TEXT,
  address         TEXT,
  town            TEXT,
  county          TEXT,
  postcode        TEXT,
  location_id     TEXT REFERENCES locations(id),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  whatsapp_num    TEXT,
  engine_on       BOOLEAN NOT NULL DEFAULT FALSE,
  qr_id           TEXT,
  reg_cert        TEXT,
  council_cert    TEXT,
  tc_agree        BOOLEAN NOT NULL DEFAULT FALSE,
  approved_by     TEXT REFERENCES system_users(id),
  approved_at     TIMESTAMPTZ,
  rejected_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Merchant managers ──────────────────────────────────────
CREATE TABLE merchant_managers (
  id            TEXT PRIMARY KEY,
  merchant_id   TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  first_name    TEXT NOT NULL,
  last_name     TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  phone         TEXT,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Customers ──────────────────────────────────────────────
CREATE TABLE customers (
  id               TEXT NOT NULL,
  merchant_id      TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  first_name       TEXT NOT NULL,
  last_name        TEXT NOT NULL,
  whatsapp         TEXT NOT NULL,
  email            TEXT,
  dob_month        TEXT,
  town             TEXT,
  tc_agree         BOOLEAN NOT NULL DEFAULT FALSE,
  subscribed       BOOLEAN NOT NULL DEFAULT TRUE,
  source           TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('qr','upload','manual')),
  rotation_group   TEXT,
  redemption_count INTEGER NOT NULL DEFAULT 0,
  registered_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, merchant_id),
  UNIQUE (merchant_id, whatsapp)
);

-- ── Discounts ──────────────────────────────────────────────
CREATE TABLE discounts (
  id          SERIAL PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  tier        TEXT NOT NULL CHECK (tier IN ('tier1','tier2','tier3')),
  day_of_week TEXT NOT NULL CHECK (day_of_week IN ('Mon','Tue','Wed','Thu','Fri','Sat','Sun')),
  pct_min     NUMERIC(5,2) NOT NULL DEFAULT 0,
  pct_max     NUMERIC(5,2) NOT NULL DEFAULT 0,
  UNIQUE (merchant_id, tier, day_of_week)
);

-- ── Working hours ──────────────────────────────────────────
CREATE TABLE working_hours (
  id          SERIAL PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  day_of_week TEXT NOT NULL CHECK (day_of_week IN ('Mon','Tue','Wed','Thu','Fri','Sat','Sun')),
  is_open     BOOLEAN NOT NULL DEFAULT FALSE,
  start_time  TEXT,
  end_time    TEXT,
  UNIQUE (merchant_id, day_of_week)
);

-- ── Flyers ─────────────────────────────────────────────────
CREATE TABLE flyers (
  id          SERIAL PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  slot_index  INTEGER NOT NULL CHECK (slot_index BETWEEN 0 AND 6),
  data_url    TEXT,
  file_name   TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (merchant_id, slot_index)
);

-- ── Campaigns ──────────────────────────────────────────────
CREATE TABLE campaigns (
  id             TEXT PRIMARY KEY,
  merchant_id    TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  campaign_date  DATE NOT NULL,
  tier           TEXT NOT NULL CHECK (tier IN ('tier1','tier2','tier3')),
  channel        TEXT NOT NULL DEFAULT 'whatsapp',
  sent_count     INTEGER NOT NULL DEFAULT 0,
  opened_count   INTEGER NOT NULL DEFAULT 0,
  redeemed_count INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'completed',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Audit logs ─────────────────────────────────────────────
CREATE TABLE audit_logs (
  id           SERIAL PRIMARY KEY,
  action       TEXT NOT NULL,
  performed_by TEXT,
  target       TEXT,
  detail       TEXT,
  ip_address   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ────────────────────────────────────────────────
CREATE INDEX idx_merchants_location   ON merchants(location_id);
CREATE INDEX idx_merchants_status     ON merchants(status);
CREATE INDEX idx_merchants_email      ON merchants(LOWER(email));
CREATE INDEX idx_system_users_email   ON system_users(LOWER(email));
CREATE INDEX idx_mgr_email            ON merchant_managers(LOWER(email));
CREATE INDEX idx_customers_merchant   ON customers(merchant_id);
CREATE INDEX idx_customers_subscribed ON customers(merchant_id, subscribed);
CREATE INDEX idx_campaigns_merchant   ON campaigns(merchant_id);
CREATE INDEX idx_logs_created         ON audit_logs(created_at DESC);

-- ── Password Reset OTP Tokens ──────────────────────
-- Single-use, 10-minute expiry. Works for all user types.
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         SERIAL PRIMARY KEY,
  email      TEXT NOT NULL,
  otp_hash   TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_prt_email   ON password_reset_tokens(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_prt_expires ON password_reset_tokens(expires_at);
