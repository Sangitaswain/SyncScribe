# SyncScribe — Backend Plan (BP)

Built from `SyncScribe-PRD.md` and `TOOLS_AND_TECHNOLOGIES.md`. Frontend counterpart: `FRONTEND_PLAN.md` (FP). The full feature/edge-case traceability matrix is in FP-20; this plan's section numbers (BP-x) match the references there.

Current workspace state: no code yet; only `docs/`.

---

## BP-1. Role of the backend

The backend is deliberately **thin**. The browser does all editing and merging; the server:

1. **Authenticates** users and issues tokens (works with offline sign-in on the client).
2. **Enforces permissions** on every sync connection and REST call — the only place roles are truly enforced.
3. **Relays and stores** Yjs CRDT updates (Hocuspocus), so devices that are never online at the same time still exchange changes.
4. **Keeps history**: periodic version snapshots per document.
5. **Sharing, workspaces, notifications, password reset, Trash purge.**

It never merges text itself — Yjs guarantees every client converges on the same state (E3, E4, EC41).

One Node.js process, one port, one SQLite file. Cost: $0.

---

## BP-2. Project structure (`apps/server`)

```
apps/server/
├── package.json
├── .env.example            # PORT, JWT_SECRET, DB_PATH, APP_URL, SMTP_* (optional)
└── src/
    ├── index.ts            # creates Express app + HTTP server + Hocuspocus, mounts routes
    ├── config.ts           # env parsing with Zod
    ├── db/
    │   ├── db.ts           # better-sqlite3 connection, WAL mode, prepared statements
    │   └── schema.sql      # tables (BP-3)
    ├── auth/
    │   ├── password.ts     # bcryptjs hash/verify
    │   ├── jwt.ts          # jose sign/verify (HS256)
    │   └── middleware.ts   # requireAuth for Express
    ├── permissions/
    │   └── resolve.ts      # roleFor(userId, resource) (BP-4.2)
    ├── routes/
    │   ├── auth.ts  me.ts  workspaces.ts  shares.ts  shareLinks.ts
    │   ├── docs.ts  versions.ts  notifications.ts  sync.ts  health.ts
    ├── collab/
    │   ├── hocuspocus.ts   # server config + hooks (BP-6)
    │   ├── persistence.ts  # fetch/store Yjs state in SQLite
    │   ├── treeIndex.ts    # reads ws: docs → documents table
    │   ├── versions.ts     # snapshot policy
    │   └── seed.ts         # personal workspace + Welcome doc at sign-up
    ├── notifications/service.ts
    ├── mail/mailer.ts      # Nodemailer (Ethereal) + console fallback
    ├── jobs/purgeTrash.ts  # node-cron daily
    └── test/               # Vitest + supertest + in-process provider tests
```

Extra free packages: `cors`, `helmet`, `express-rate-limit`, `ws` (used by Hocuspocus), `nanoid`, `supertest` (tests). All MIT.

---

## BP-3. Database schema (SQLite)

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  color         TEXT NOT NULL,                 -- cursor colour (A4)
  personal_workspace_id TEXT NOT NULL,
  created_at    INTEGER NOT NULL
);

CREATE TABLE password_resets (                 -- A5
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  used_at    INTEGER
);

CREATE TABLE workspaces (                      -- B1, B2
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('personal','team')),
  owner_id   TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL
);

CREATE TABLE workspace_members (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL CHECK (role IN ('owner','editor','commenter','viewer')),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE documents (                       -- index of docs, filled from ws: trees (BP-6.4)
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  parent_id    TEXT,                           -- folder id (for folder shares)
  type         TEXT NOT NULL CHECK (type IN ('doc','folder')),
  owner_id     TEXT NOT NULL REFERENCES users(id),
  title        TEXT NOT NULL DEFAULT '',       -- cached for "Shared with me"
  deleted_at   INTEGER,
  updated_at   INTEGER NOT NULL
);
CREATE INDEX idx_documents_ws ON documents(workspace_id);

CREATE TABLE shares (                          -- G1, G2, G4
  id            TEXT PRIMARY KEY,
  resource_id   TEXT NOT NULL,                 -- doc or folder id
  user_id       TEXT REFERENCES users(id) ON DELETE CASCADE,  -- null until invitee signs up
  invited_email TEXT COLLATE NOCASE,           -- EC22
  role          TEXT NOT NULL CHECK (role IN ('editor','commenter','viewer')),
  created_by    TEXT NOT NULL REFERENCES users(id),
  created_at    INTEGER NOT NULL,
  UNIQUE (resource_id, user_id),
  UNIQUE (resource_id, invited_email)
);

CREATE TABLE share_links (                     -- G3
  id          TEXT PRIMARY KEY,
  token_hash  TEXT NOT NULL UNIQUE,
  resource_id TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('editor','commenter','viewer')),
  created_by  TEXT NOT NULL REFERENCES users(id),
  created_at  INTEGER NOT NULL,
  revoked_at  INTEGER                          -- EC23
);

CREATE TABLE ydoc_state (                      -- Hocuspocus persistence
  name       TEXT PRIMARY KEY,                 -- 'ws:..', 'doc:..', 'cm:..', 'user:..'
  state      BLOB NOT NULL,                    -- Y.encodeStateAsUpdate
  updated_at INTEGER NOT NULL
);

CREATE TABLE versions (                        -- H1–H4
  id         TEXT PRIMARY KEY,
  doc_id     TEXT NOT NULL,
  state      BLOB NOT NULL,
  name       TEXT,                             -- H4 named version
  authors    TEXT NOT NULL,                    -- JSON array of user ids
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_versions_doc ON versions(doc_id, created_at DESC);

CREATE TABLE notifications (                   -- J3
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('shared','mentioned','access_removed','role_changed')),
  payload    TEXT NOT NULL,                    -- JSON
  read_at    INTEGER,
  created_at INTEGER NOT NULL
);
```

---

## BP-4. Authentication and permissions

### BP-4.1 Tokens

- Passwords hashed with bcryptjs (cost 10). Minimum length 8 (validated by shared Zod schema).
- Access token: JWT HS256 signed with `JWT_SECRET`, payload `{ sub: userId, name, color }`, lifetime **7 days** — long enough for offline periods; the client keeps working offline even after expiry and re-authenticates on reconnect (A3, EC19).
- `POST /api/auth/refresh` issues a new token while the current one is valid.
- Same token used for REST (`Authorization: Bearer`) and WebSocket (`token` sent by the Hocuspocus provider).
- Login and reset endpoints rate-limited (`express-rate-limit`, 10/min/IP).

### BP-4.2 Role resolution (`permissions/resolve.ts`)

Roles ranked: `owner > editor > commenter > viewer > none`.

`roleFor(userId, docName)`:

| Doc name | Rule |
| --- | --- |
| `user:{id}` | `owner` if `id === userId`, else `none` |
| `ws:{id}` | role in `workspace_members`, else `none` |
| `doc:{id}` | highest of: `owner` if `documents.owner_id = userId`; workspace member role; explicit share on the doc; share on any ancestor folder (walk `parent_id`) |
| `cm:{id}` | same as `doc:{id}` |

Capabilities (shared in `packages/shared/roles.ts`, used by both client and server):

| Capability | owner | editor | commenter | viewer |
| --- | --- | --- | --- | --- |
| read doc | ✓ | ✓ | ✓ | ✓ |
| write `doc:` | ✓ | ✓ | – | – |
| write `cm:` | ✓ | ✓ | ✓ | – |
| invite (up to editor) | ✓ | ✓ | – | – |
| change/remove access, share links | ✓ | – | – | – |
| permanent delete | ✓ | – | – | – |

---

## BP-5. REST API (Express, JSON, all bodies validated with Zod)

All routes except auth, health and share-link preview require `requireAuth`. Errors: `{ error: { code, message } }` with plain-language messages for the UI.

### BP-5.1 Auth and profile

| Method | Path | Purpose | PRD |
| --- | --- | --- | --- |
| POST | `/api/auth/signup` | Create user; create personal workspace + member row; seed `ws:` tree and **Welcome document** (BP-6.5); attach pending email invites (EC22); return `{ user, token, workspaces }` | A1, B1, J4 |
| POST | `/api/auth/login` | Verify password; return `{ user, token, workspaces }` | A2 |
| POST | `/api/auth/refresh` | New token | A3, EC19 |
| POST | `/api/auth/forgot` | Create reset token (hashed, 1 h expiry), email link (always 200 to avoid revealing accounts) | A5 |
| POST | `/api/auth/reset` | Set new password with valid token | A5 |
| GET | `/api/me` | Profile + workspaces | A4 |
| PATCH | `/api/me` | Update name, colour | A4 |

### BP-5.2 Workspaces (B2)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/workspaces` | Workspaces I belong to |
| POST | `/api/workspaces` | Create team workspace (I'm owner); seed empty `ws:` doc |
| GET | `/api/workspaces/:id/members` | List members |
| POST | `/api/workspaces/:id/members` | Invite by email + role (owner) → notification / email |
| PATCH | `/api/workspaces/:id/members/:userId` | Change role (owner) → close that user's sockets for the workspace (BP-6.2) |
| DELETE | `/api/workspaces/:id/members/:userId` | Remove member (owner) |

### BP-5.3 Sharing (G1–G4, EC22, EC23)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/shares?resource=:id` | Who has access (owner/editor can view) |
| POST | `/api/shares` | `{ resourceId, email, role }`. Editors may grant up to editor; owners any. If email has an account → share row + `shared` notification; else row with `invited_email` + signup email |
| PATCH | `/api/shares/:id` | Change role (owner) → `role_changed` notification + reconnect sockets |
| DELETE | `/api/shares/:id` | Remove access (owner) → `access_removed` notification + close sockets |
| GET | `/api/shared-with-me` | Docs/folders shared to me with cached titles |
| POST | `/api/share-links` | Create link `{ resourceId, role }` → returns URL with random token (only hash stored) |
| DELETE | `/api/share-links/:id` | Revoke |
| POST | `/api/share-links/:token/accept` | Valid & not revoked → add share for caller; else `410 { code: "link_inactive", message: "This link is no longer active" }` |

### BP-5.4 Documents / Trash (B10)

| Method | Path | Purpose |
| --- | --- | --- |
| DELETE | `/api/docs/:id` | Permanent delete (owner only): delete `ydoc_state` for `doc:`/`cm:`, versions, shares, links, `documents` row. (Client removes the tree item from `ws:`; if it hasn't yet, server removes it via direct connection.) |

Moving to Trash and restoring are CRDT changes in `ws:` docs — no REST needed (works offline).

### BP-5.5 Versions (H1, H2, H4)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/docs/:id/versions` | List `{ id, name, authors, createdAt }` newest first |
| GET | `/api/versions/:vid` | Version state (binary `application/octet-stream`) for client-side decode |
| POST | `/api/docs/:id/versions` | Create a **named** snapshot now `{ name }` (editor+) |
| PATCH | `/api/versions/:vid` | Rename a version |

Restore (H3) is done on the client as a new CRDT change — no server endpoint needed.

### BP-5.6 Notifications and mentions (J3, F5)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/notifications?unread=1` | My notifications |
| POST | `/api/notifications/read` | `{ ids }` mark read |
| POST | `/api/mentions` | `{ docId, threadId, userIds }` from the client outbox → `mentioned` notifications for users who can read the doc |

Live delivery: when a notification is created and the recipient has an open socket, send a Hocuspocus **stateless** message `{ type: "notification", ... }` on their `user:{id}` connection.

### BP-5.7 Sync helpers (E2, A6)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/sync/changed?since=ms` | Doc names I can access with `ydoc_state.updated_at > since` — lets the client fetch remote changes for docs that aren't open |
| GET | `/api/sync/all` | Every doc name I can access (new device bootstrap, DF13) |

### BP-5.8 Health (E1, EC3)

`GET /api/health` → `{ ok: true, time }`. Used by the client Network Monitor to detect "online but server unreachable".

---

## BP-6. Real-time sync server (Hocuspocus)

### BP-6.1 Configuration

```ts
const hocuspocus = Server.configure({
  debounce: 2000,          // store at most every 2 s while editing
  maxDebounce: 10000,      // and at least every 10 s
  extensions: [ new Database({ fetch, store }) ],  // persistence.ts → ydoc_state
  onAuthenticate, onLoadDocument, onChange, onStoreDocument, onDisconnect,
});
// Mounted on the same HTTP server as Express at path /collab (WebSocket upgrade).
// ws maxPayload: 10 MB (images ≤ 2 MB each, EC34).
```

### BP-6.2 `onAuthenticate` — permission enforcement (G5, EC16–EC19, EC39)

```
verify JWT → fail: throw "token-expired" | "invalid-token"     → client shows re-auth (EC19)
role = roleFor(user, documentName)
role == none:
    if doc: unknown in documents table → throw "unknown-doc"   (client retries after ws: sync; BP-6.4)
    else throw "forbidden"                                      → client EC16 flow
if doc: and role in (commenter, viewer)  → connection.readOnly = true
if cm:  and role == viewer               → connection.readOnly = true
if ws:  and role in (commenter, viewer)  → connection.readOnly = true
return { user: { id, name }, role }      // available in later hooks as context
```

- **Read-only connections** receive updates but the server **discards** any update they send, so a modified client cannot edit (G5, EC18).
- **Access removed / role lowered while connected (EC16, EC17):** share/member routes call `closeConnectionsFor(userId, docNames)`; the client reconnects and re-authenticates with the new role (read-only or forbidden). Changes made offline after the change are rejected at reconnect because the connection is read-only or refused.
- **Repeated sync rejection (EC39):** any thrown error carries a short reason string that the client shows in the "Sync error" state with Retry.

### BP-6.3 Persistence and versions

- `fetch(name)` → `SELECT state FROM ydoc_state WHERE name = ?`.
- `store(name, state)` → upsert with `updated_at = now` (powers `/api/sync/changed`).
- `onChange` records `context.user.id` in an in-memory `authorsSince[docName]` set.
- `onStoreDocument` for `doc:` names → `maybeSnapshot(docName)`:
  - insert a version if last version is older than **10 minutes** *or* this is the first store after a period of no connections (session end), with `authors = authorsSince` → reset set;
  - named versions (H4) inserted immediately by the REST route using the current in-memory doc via `openDirectConnection`.
- Retention: keep all named versions; keep the latest 200 automatic versions per doc (prune oldest).
- **Attribution (H2, Could):** versions store author lists; the client diff between consecutive versions highlights inserted text per version's authors. Fine-grained per-character attribution via `Y.PermanentUserData` is a stretch goal.
- **Offline edits and versions:** a snapshot is taken when offline changes arrive, so they appear in history once synced (4.5 step 7).

### BP-6.4 Tree index (`collab/treeIndex.ts`)

The server must know which workspace a new doc belongs to (docs can be created offline):

- `onChange` / `onStoreDocument` for `ws:{id}`: read the `items` map and upsert rows into `documents` (id, type, parent_id, owner_id = `createdBy`, deleted_at). Folder `name` → `title`.
- `onStoreDocument` for `doc:{id}`: update `documents.title` from `meta.title` (C8).
- The client attaches `doc:` providers only **after** its `ws:` provider is synced (FP-10.1), so the doc row exists by then; `unknown-doc` triggers a client retry in the rare race.
- Owner forging `createdBy` is limited to members with write access to the workspace — acceptable for this project (documented risk).

### BP-6.5 Seeding (`collab/seed.ts`) — J4, B1

At sign-up: build a `ws:` Y.Doc with one doc item "Welcome to SyncScribe" and a `doc:` Y.Doc with markdown explaining offline use, sync status, sharing and that clearing browser data deletes unsynced changes (EC26). Encode both and insert into `ydoc_state`.

### BP-6.6 Awareness and live collaboration (F1–F3)

Hocuspocus relays awareness (presence, cursors) to all connections on a document; never stored (DF9). Live edits are broadcast to other connections immediately (F1: ~100 ms on a local network).

### BP-6.7 Multi-document, multi-device, merge correctness

- One socket per client multiplexes many docs.
- Devices offline for weeks: on reconnect the Yjs sync protocol exchanges state vectors and only missing updates; duplicate updates are idempotent, so a connection dropped mid-sync loses nothing and applies nothing twice (EC1, EC5).
- Structural conflicts (moves, renames, deletes) are CRDT map updates in `ws:` docs; the server stores the merged result and every client resolves the tree identically (E9, EC10–EC13 — rules in FP-4.6, FP-8.3).

---

## BP-7. Data flows on the server (PRD DF mapping)

| PRD flow | Server part |
| --- | --- |
| DF2, DF6, DF7 | Hocuspocus relay + `store` |
| DF5 | Reconnect → `onAuthenticate` → sync step → `store` |
| DF8 | `ws:` doc sync + tree index |
| DF9 | Awareness relay (memory only) |
| DF10 | `POST /api/shares` → notification (+ email) |
| DF11 | Share/member change → close sockets → re-auth with new role |
| DF12 | Restore arrives as normal doc update → stored → snapshot |
| DF13 | `/api/sync/all` + Hocuspocus loads |
| DF1, DF3, DF4, DF14, DF15, DF16 | Client only (no server involvement) |

---

## BP-8. Security

- Helmet headers; CORS restricted to `APP_URL`.
- All REST input validated with Zod; prepared SQL statements only.
- Share-link and reset tokens: 32 random bytes, only SHA-256 hashes stored.
- Generic responses on forgot-password (no account enumeration).
- Permission check on **every** REST route that touches a resource, using `roleFor`.
- Server never renders user markdown (no XSS surface server-side).

---

## BP-9. Background jobs and email

- **Trash purge (B10):** `node-cron` daily at 03:00 — for each `ws:` doc, open a direct connection, find items with `deletedAt` older than 30 days, remove them from `items`, delete their `doc:`/`cm:` state, versions, shares (same as BP-5.4).
- **Version pruning:** same job prunes automatic versions beyond 200 per doc.
- **Email (A5, G1, EC22):** `mailer.send()` uses Nodemailer with an Ethereal test account (free); in dev it logs the message URL and the link to the console. No paid provider.

---

## BP-10. Performance and limits

- SQLite WAL mode; prepared statements; Yjs states stored as compact binary.
- Hocuspocus keeps active docs in memory and unloads them when no connections remain (after store).
- 20 simultaneous editors on one doc (EC15) is well within a single Node process.
- Payload limit 10 MB per message; images limited to 2 MB on the client (EC34).
- Large documents (EC31): Yjs handles 100k-word texts; storage is incremental via debounce.

---

## BP-11. Configuration and running

`.env.example`:

```
PORT=4000
APP_URL=http://localhost:5173
JWT_SECRET=change-me-to-a-long-random-string
DB_PATH=./data/syncscribe.db
SMTP_URL=            # optional; empty = Ethereal/console
```

- `npm run dev -w apps/server` — `tsx watch src/index.ts`.
- Root `npm run dev` runs web (5173) and server (4000) together (`concurrently`, MIT).
- Optional free deploy: Render web service (`npm run build && npm start`); frontend on Netlify/Vercel with `VITE_API_URL` and `VITE_COLLAB_URL` env vars.

---

## BP-12. Testing plan (backend)

**REST (Vitest + supertest, temp SQLite file per test run)**
- Sign-up seeds workspace + Welcome doc; login; refresh; forgot/reset.
- Share by editor up to editor only; owner role changes; link accept / revoked link → 410 (EC23); invite to unknown email attached at sign-up (EC22).
- `/api/sync/changed` returns only accessible docs.

**Sync (in-process Hocuspocus + `@hocuspocus/provider` with `ws` in Node)**
- Two providers edit offline-style (connect sequentially) → server state equals both clients (E3, E4).
- Viewer connection: send update → server state unchanged (G5, EC18).
- Remove share while connected → connection closed → reconnect refused `forbidden` (EC16).
- Version snapshot created after store; named version endpoint.

---

## BP-13. Build order for the 2-day deadline

**Day 1**
1. Server scaffold, config, SQLite schema, health route (BP-2, BP-3, BP-5.8).
2. Auth routes + JWT + seeding personal workspace and Welcome doc (BP-4, BP-5.1, BP-6.5).
3. Hocuspocus with SQLite persistence and `onAuthenticate` (owner-only first) (BP-6.1–6.3).
4. Tree index + `/api/sync/*` (BP-6.4, BP-5.7).

**Day 2**
5. Roles + shares + share links + read-only connections + socket closing on access change (BP-4.2, BP-5.3, BP-6.2).
6. Versions endpoints + snapshot policy (BP-5.5, BP-6.3).
7. Notifications + mentions + stateless delivery (BP-5.6).
8. Workspaces/team members (BP-5.2), Trash purge job, mailer (BP-9).
9. Backend tests for merge, read-only, revoke (BP-12).
