-- ============================================================
-- WAY SERVIDORES - Banco de dados PostgreSQL
-- Execute após criar o banco: psql -d way_servidores -f 001_init.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS servers (
  id          UUID PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  engine      TEXT NOT NULL,
  mc_version  TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'installing',
  memory_mb   INTEGER NOT NULL DEFAULT 2048,
  port        INTEGER NOT NULL,
  install_dir TEXT NOT NULL,
  started_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_servers_status ON servers(status);
CREATE INDEX IF NOT EXISTS idx_servers_engine ON servers(engine);

CREATE TABLE IF NOT EXISTS installed_plugins (
  id         BIGSERIAL PRIMARY KEY,
  server_id  UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  provider   TEXT NOT NULL,
  remote_id  TEXT NOT NULL,
  name       TEXT NOT NULL,
  file_name  TEXT NOT NULL,
  installed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS installed_mods (
  id         BIGSERIAL PRIMARY KEY,
  server_id  UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  provider   TEXT NOT NULL,
  remote_id  TEXT NOT NULL,
  name       TEXT NOT NULL,
  file_name  TEXT NOT NULL,
  installed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS domains (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostname   TEXT NOT NULL UNIQUE,
  server_id  UUID REFERENCES servers(id) ON DELETE SET NULL,
  target     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO settings (key, value) VALUES ('schema_version', '1')
  ON CONFLICT (key) DO NOTHING;