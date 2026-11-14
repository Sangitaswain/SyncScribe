-- SyncScribe database schema (BACKEND_PLAN.md BP-3)

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  color         TEXT NOT NULL,
  personal_workspace_id TEXT NOT NULL,
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  used_at    INTEGER
);

CREATE TABLE IF NOT EXISTS workspaces (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('personal','team')),
  owner_id   TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL CHECK (role IN ('owner','editor','commenter','viewer')),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS documents (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  parent_id    TEXT,
  type         TEXT NOT NULL CHECK (type IN ('doc','folder')),
  owner_id     TEXT NOT NULL REFERENCES users(id),
  title        TEXT NOT NULL DEFAULT '',
  deleted_at   INTEGER,
  updated_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_documents_ws ON documents(workspace_id);

CREATE TABLE IF NOT EXISTS shares (
  id            TEXT PRIMARY KEY,
  resource_id   TEXT NOT NULL,
  user_id       TEXT REFERENCES users(id) ON DELETE CASCADE,
  invited_email TEXT COLLATE NOCASE,
  role          TEXT NOT NULL CHECK (role IN ('editor','commenter','viewer')),
  created_by    TEXT NOT NULL REFERENCES users(id),
  created_at    INTEGER NOT NULL,
  UNIQUE (resource_id, user_id),
  UNIQUE (resource_id, invited_email)
);

CREATE TABLE IF NOT EXISTS share_links (
  id          TEXT PRIMARY KEY,
  token_hash  TEXT NOT NULL UNIQUE,
  resource_id TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('editor','commenter','viewer')),
  created_by  TEXT NOT NULL REFERENCES users(id),
  created_at  INTEGER NOT NULL,
  revoked_at  INTEGER
);

CREATE TABLE IF NOT EXISTS ydoc_state (
  name       TEXT PRIMARY KEY,
  state      BLOB NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS versions (
  id         TEXT PRIMARY KEY,
  doc_id     TEXT NOT NULL,
  state      BLOB NOT NULL,
  name       TEXT,
  authors    TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_versions_doc ON versions(doc_id, created_at DESC);

CREATE TABLE IF NOT EXISTS notifications (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('shared','mentioned','access_removed','role_changed')),
  payload    TEXT NOT NULL,
  read_at    INTEGER,
  created_at INTEGER NOT NULL
);
