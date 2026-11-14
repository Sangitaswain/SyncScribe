# SyncScribe — Implementation Plan

> ## ⚠️ CRITICAL RULE — READ BEFORE EVERY SESSION
>
> **Each step and substep must be marked as complete (`[x]`) immediately after it is implemented and verified, before moving on to the next one. No skipping ahead.**
>
> - Work strictly top to bottom. A step is complete only when **all** its substeps are checked.
> - Each substep ends with a commit using the exact one-line message given. Commit after the substep's "Done when" check passes.
> - Commit messages must **not** contain "Co-authored-by", "Generated with", or any AI attribution.
> - If a substep cannot be finished, stop, write a note under it (`> Blocked: …`), and resolve it before continuing.

**Source documents:** `SyncScribe-PRD.md` (what), `TOOLS_AND_TECHNOLOGIES.md` (with what), `FRONTEND_PLAN.md` (FP), `BACKEND_PLAN.md` (BP). References like `FP-8.2` or `BP-6.2` point to the section with full details. Feature and edge-case IDs (A1, EC12…) come from the PRD.

**Schedule:** Day 1 = Steps 1–9 (offline-first core). Day 2 = Steps 10–20 (sync, collaboration, sharing, Should features, tests, demo, and the Could features in Step 20). All 20 steps are in scope.

**Legend:** `[ ]` not started · `[x]` complete · **Done when** = how to verify before committing.

---

## Progress overview

| # | Step | Day | Status |
| --- | --- | --- | --- |
| 1 | Repository and tooling setup | 1 | [x] |
| 2 | Shared package | 1 | [x] |
| 3 | Backend foundation: server, database, health | 1 | [x] |
| 4 | Backend authentication and seeding | 1 | [x] |
| 5 | Frontend shell, routing, PWA | 1 | [x] |
| 6 | Frontend auth and offline session | 1 | [x] |
| 7 | Local-first data layer (Yjs + IndexedDB) | 1 | [x] |
| 8 | Sidebar, tree and document organization | 1 | [x] |
| 9 | Markdown editor and preview | 1 | [x] |
| 10 | Sync server (Hocuspocus) | 1–2 | [x] |
| 11 | Frontend sync engine and network status | 2 | [ ] |
| 12 | Real-time collaboration and presence | 2 | [ ] |
| 13 | Permissions, sharing and workspaces | 2 | [ ] |
| 14 | Trash and structural edge cases | 2 | [ ] |
| 15 | Search | 2 | [ ] |
| 16 | Version history | 2 | [ ] |
| 17 | Import, export, notifications, storage safety | 2 | [ ] |
| 18 | Testing | 2 | [ ] |
| 19 | Polish, docs and demo | 2 | [ ] |
| 20 | Could features: comments, mentions, tags, pins, TOC, templates, focus mode, attribution, tab-hide flush | 2 | [ ] |

---

## Step 1 — Repository and tooling setup

- [x] **1.1** Initialise git in the project root, add `.gitignore` (node_modules, dist, .env, `apps/server/data/`, .DS_Store), and commit the existing `docs/`.
  - Done when: `git log` shows the first commit with all docs.
  - Commit: `chore: initialise repository with project documents`
- [x] **1.2** Create root `package.json` with npm workspaces (`apps/*`, `packages/*`), Node 20 engine, and scripts `dev`, `build`, `test`, `e2e`, `lint`.
  - Done when: `npm install` succeeds at the root.
  - Commit: `chore: set up npm workspaces monorepo`
- [x] **1.3** Add shared TypeScript config (`tsconfig.base.json`, strict mode), ESLint and Prettier configs at the root.
  - Done when: `npm run lint` runs without config errors.
  - Commit: `chore: add TypeScript, ESLint and Prettier configuration`
- [x] **1.4** Add `concurrently` and wire the root `dev` script to run web and server together (placeholders for now).
  - Done when: `npm run dev` starts both placeholder processes.
  - Commit: `chore: add combined dev script for web and server`

## Step 2 — Shared package (`packages/shared`) · FP-2, BP-4.2

- [x] **2.1** Scaffold `packages/shared` (package.json, tsconfig, `src/index.ts`).
  - Done when: it builds and can be imported by name from another workspace.
  - Commit: `feat(shared): scaffold shared package`
- [x] **2.2** Add `roles.ts`: `Role` type, rank order, `can(role, capability)` per the BP-4.2 capability table; unit tests.
  - Done when: Vitest tests for every role × capability pass.
  - Commit: `feat(shared): add roles and capability helpers`
- [x] **2.3** Add `ydoc-keys.ts`: doc name builders (`wsDoc`, `docDoc`, `cmDoc`, `userDoc`) and field key constants (FP-4).
  - Done when: exported and type-checked.
  - Commit: `feat(shared): add Yjs document names and keys`
- [x] **2.4** Add `types.ts` and `schemas.ts` (Zod): signup, login, profile, share, share link, workspace, version, notification, mention payloads.
  - Done when: schemas compile and a sample payload parses in a test.
  - Commit: `feat(shared): add shared types and Zod schemas`

## Step 3 — Backend foundation · BP-2, BP-3, BP-5.8, BP-8, BP-11

- [x] **3.1** Scaffold `apps/server` with Express, `tsx` dev runner, `config.ts` (Zod-validated env) and `.env.example`.
  - Done when: `npm run dev -w apps/server` starts on port 4000.
  - Commit: `feat(server): scaffold Express server with config`
- [x] **3.2** Add `db.ts` (better-sqlite3, WAL, foreign keys) and `schema.sql` with all BP-3 tables; apply schema on boot.
  - Done when: the server creates `data/syncscribe.db` containing all tables.
  - Commit: `feat(server): add SQLite database and schema`
- [x] **3.3** Add Helmet, CORS restricted to `APP_URL`, JSON body limit, a central error handler that returns `{ error: { code, message } }`.
  - Done when: an unknown route returns a JSON 404 error.
  - Commit: `feat(server): add security middleware and error handling`
- [x] **3.4** Add `GET /api/health` (BP-5.8).
  - Done when: `curl localhost:4000/api/health` returns `{ ok: true }`.
  - Commit: `feat(server): add health check endpoint`

## Step 4 — Backend authentication and seeding · BP-4.1, BP-5.1, BP-6.5

- [x] **4.1** Add `password.ts` (bcryptjs) and `jwt.ts` (jose HS256, 7-day expiry) plus `requireAuth` middleware.
  - Done when: unit test signs and verifies a token; expired token is rejected.
  - Commit: `feat(server): add password hashing and JWT auth`
- [x] **4.2** Add `seed.ts`: build a personal `ws:` Y.Doc with a "Welcome to SyncScribe" item and its `doc:` Y.Doc (offline tips, sync status, data-clearing warning); store both in `ydoc_state`.
  - Done when: a test seeds and decodes both docs correctly.
  - Commit: `feat(server): seed personal workspace and welcome document`
- [x] **4.3** Add `POST /api/auth/signup` (create user, colour, personal workspace, member row, seed) and `POST /api/auth/login`; rate-limit both.
  - Done when: supertest signs up, logs in, rejects wrong password and duplicate email.
  - Commit: `feat(server): add signup and login endpoints`
- [x] **4.4** Add `POST /api/auth/refresh`, `GET /api/me`, `PATCH /api/me`.
  - Done when: supertest covers all three.
  - Commit: `feat(server): add token refresh and profile endpoints`
- [x] **4.5** Add `mailer.ts` (Nodemailer with Ethereal, console fallback) and `POST /api/auth/forgot` + `POST /api/auth/reset` (hashed token, 1 h expiry, always-200 on forgot).
  - Done when: reset link is printed to the console and resetting the password works.
  - Commit: `feat(server): add password reset with dev mailer`

## Step 5 — Frontend shell, routing, PWA · FP-2, FP-6, FP-7, FP-16

- [x] **5.1** Scaffold `apps/web` with Vite + React + TypeScript; Tailwind with `dark` class mode; lucide-react.
  - Done when: `npm run dev -w apps/web` shows a styled page at :5173.
  - Commit: `feat(web): scaffold React app with Vite and Tailwind`
- [x] **5.2** Add React Router with all FP-6 routes as placeholder screens and a Not Found page.
  - Done when: every route renders its placeholder.
  - Commit: `feat(web): add routes for all screens`
- [x] **5.3** Build `AppShell` layout: sidebar slot, `TopBar`, main area, `StatusBar`, `Toaster`.
  - Done when: layout renders on desktop and narrow widths.
  - Commit: `feat(web): add app shell layout`
- [x] **5.4** Add Zustand stores from FP-5 (session, network, docStatus, ui, notification, presence) with initial state.
  - Done when: stores are importable and typed.
  - Commit: `feat(web): add client state stores`
- [x] **5.5** Configure `vite-plugin-pwa`: precache app shell, manifest + icons, `registerType: "prompt"`, network-only for `/api/*`; add `UpdateAvailableToast` (D2, D5, EC30).
  - Done when: after one visit, DevTools → Offline → reload still loads the app; Chrome shows an install option.
  - Commit: `feat(web): make app installable and loadable offline`
- [x] **5.6** Add the boot fallback message "Connect once to set up SyncScribe" for first visits with no connection (EC4).
  - Done when: clearing site data and loading offline shows the message, not a blank page.
  > Note: on a true first visit with no network the browser cannot fetch `index.html` at all and shows its own offline page; no app code can run. The fallback covers the case where the page loads but the app bundle does not, and Step 6.3's route guard covers "app loaded, never signed in, offline".
  - Commit: `feat(web): show setup message on first offline visit`

## Step 6 — Frontend auth and offline session · FP-11, FP-4.7

- [x] **6.1** Add the REST client (`services/api.ts`) with base URL from env, bearer token, typed errors, 401 → `needsReauth`.
  - Done when: a call to `/api/health` works from the app.
  - Commit: `feat(web): add typed REST client`
- [x] **6.2** Build Sign up and Sign in screens with Zod validation; on success save `session` to idb-keyval and the store (A1, A2).
  - Done when: a new user can sign up and lands on `/`.
  - Commit: `feat(web): add sign up and sign in screens`
- [x] **6.3** Implement offline boot: read cached `session` on start and render the app without network; route guard per FP-6 (A3).
  - Done when: signed-in user reloads offline and stays in the app.
  - Commit: `feat(web): keep users signed in offline`
- [x] **6.4** Add token refresh on reconnect and `ReauthModal` for expired sessions that keeps local data (EC19).
  - Done when: forcing an expired token shows the modal; signing in resumes without data loss.
  - Commit: `feat(web): handle token refresh and re-authentication`
- [x] **6.5** Add Forgot / Reset password screens (A5) and Settings → Profile (name, colour) (A4).
  - Done when: both flows work end to end against the server.
  - Commit: `feat(web): add password reset and profile settings`

## Step 7 — Local-first data layer · FP-4, FP-8.1, FP-8.2

- [x] **7.1** Implement the Doc Registry (`getDoc`, `releaseDoc`, ref counting) with `y-indexeddb` persistence named `${userId}:${docName}` (D3, EC21).
  - Done when: a test doc survives a page reload.
  - Commit: `feat(web): add Yjs document registry with IndexedDB persistence`
- [x] **7.2** Add React hooks to subscribe to Y.Map / Y.Text / Y.Array changes (`useYMap`, `useYText`).
  - Done when: a demo component re-renders on Yjs changes.
  - Commit: `feat(web): add React hooks for Yjs data`
- [x] **7.3** Implement workspace tree operations in `crdt/tree.ts`: createDoc, createFolder, rename, move, setTags, duplicate (FP-8.2), each in one transaction.
  - Done when: unit tests for each operation pass.
  - Commit: `feat(web): add workspace tree operations`
- [x] **7.4** Implement `resolveTree` with orphan-to-root, deterministic cycle breaking and sorting (FP-4.6, EC12, B6).
  - Done when: unit tests cover orphans, a two-folder cycle resolved identically on two docs, and all sort modes.
  - Commit: `feat(web): add deterministic tree resolution`
- [x] **7.5** Track local changes as pending in `{uid}:pending` on every non-provider update (D4).
  - Done when: editing a doc offline creates a pending entry that persists across reload.
  - Commit: `feat(web): track pending local changes`
- [x] **7.6** Add the `user:{uid}` prefs doc helpers: pins, recents (max 20), settings (FP-4.5).
  - Done when: opening docs updates recents; settings persist.
  - Commit: `feat(web): add per-user preferences document`

## Step 8 — Sidebar, tree and document organization · FP-7, B1–B9

- [x] **8.1** Build `TreeView`/`TreeNode` from `resolveTree` with expand/collapse and active-doc highlight (B4).
  - Done when: the Welcome doc shows in the sidebar.
  > Note: added `GET /api/sync/bootstrap` + client `bootstrap()` (downloads the user's workspaces and documents at sign-in and on start-up), so the Welcome doc shows right after sign-up. This is an early form of 11.8; live sync replaces it later.
  - Commit: `feat(web): render workspace tree in sidebar`
- [x] **8.2** Add `NewMenu` (new doc, new folder) and context menu actions: rename, move to…, duplicate, delete (to Trash placeholder) (B3, C1, C8, C9).
  - Done when: all actions work offline and survive reload.
  - Commit: `feat(web): add create, rename, duplicate and move actions`
- [x] **8.3** Add drag-and-drop moves with `@dnd-kit/core` (B5).
  - Done when: dragging a doc into a folder updates the tree.
  - Commit: `feat(web): add drag-and-drop for documents and folders`
- [x] **8.4** Add `SortMenu` and Recent section (B6, B9).
  - Done when: sort choice persists; recents list updates when docs are opened.
  - Commit: `feat(web): add sorting and recent documents`

## Step 9 — Markdown editor and preview · FP-9

- [x] **9.1** Create the CodeMirror editor bound to `Y.Text` via `y-codemirror.next` with GFM markdown highlighting, line wrapping (C2).
  - Done when: typing in a doc persists across reload offline (C6, US3).
  - Commit: `feat(web): add markdown editor bound to Yjs`
- [x] **9.2** Add `Y.UndoManager` with local-origin tracking for undo/redo (C7, EC14).
  - Done when: Cmd+Z / Cmd+Shift+Z work.
  - Commit: `feat(web): add CRDT-aware undo and redo`
- [x] **9.3** Add `DocTitle` inline rename writing to `meta.title`; empty title shows "Untitled"; new docs open with the cursor in the title (C8, EC36, 4.3).
  - Done when: renaming updates the sidebar.
  - Commit: `feat(web): add inline document title editing`
- [x] **9.4** Add `MarkdownPreview` (react-markdown, remark-gfm, rehype-sanitize, rehype-highlight) with error boundary and debounce, plus edit / split / preview `ModeSwitch` saved in settings (C3, EC31, EC33, EC37).
  - Done when: a `<script>` tag in markdown is shown as text and never runs; modes persist.
  - Commit: `feat(web): add sanitized live preview with view modes`
- [x] **9.5** Add `StatusBar` text ("Saved on this device"), word count and reading time (C6, C12).
  - Done when: counts update while typing.
  - Commit: `feat(web): add editor status bar with word count`

> Note (user request): UI restyled with a clean, AFFiNE-inspired layout — sidebar with workspace switcher, Search / All docs / Settings, Recent, Organize, Trash and profile; page header with breadcrumb and view switch; "All docs" home page; Inter font bundled for offline use. SyncScribe keeps its own name and logo. Added a public landing page at `/welcome` (nav, hero with app mock-up, tech strip, features, how it works, FAQ, CTA, footer); signed-out visitors are sent there.

**→ Day 1 checkpoint:** the app works fully offline for a single user: sign in, create, organize, edit, preview, reload.

## Step 10 — Sync server (Hocuspocus) · BP-6

- [x] **10.1** Add Hocuspocus on the same HTTP server at `/collab` with SQLite `fetch`/`store` persistence (debounce 2 s / max 10 s, 10 MB payload) (BP-6.1, BP-6.3).
  - Done when: a Node test provider writes text, the server restarts, and the text is still there.
  - Commit: `feat(server): add Hocuspocus sync server with SQLite persistence`
- [x] **10.2** Implement `onAuthenticate`: verify JWT, reject `token-expired`/`invalid-token`, resolve role (owner/workspace member only for now), set read-only per BP-6.2.
  - Done when: tests show an invalid token is refused and a member connects.
  - Commit: `feat(server): authenticate sync connections`
- [x] **10.3** Implement the tree index: `ws:` changes upsert the `documents` table; `doc:` stores update cached titles; `unknown-doc` reason when not found (BP-6.4).
  - Done when: creating a doc in a `ws:` doc via a test provider creates a `documents` row.
  - Commit: `feat(server): index workspace trees into documents table`
- [x] **10.4** Add `GET /api/sync/changed?since=` and `GET /api/sync/all` filtered by access (BP-5.7).
  - Done when: supertest shows only accessible docs are returned.
  - Commit: `feat(server): add sync change-listing endpoints`

## Step 11 — Frontend sync engine and network status · FP-10.1–10.3

- [x] **11.1** Implement the Provider Manager: one multiplexed `HocuspocusProviderWebsocket`; always attach `user:` and `ws:` docs; attach open `doc:` after `ws:` is synced (E2).
  - Done when: edits in one browser profile appear in another after both are online.
  - Commit: `feat(web): add provider manager for background sync`
- [x] **11.2** Clear pending flags on `synced` with zero unsynced changes; show `PendingDot` per doc and "All changes synced" toast (D4, E6, 4.4).
  - Done when: offline edits show dots; reconnecting clears them automatically.
  - Commit: `feat(web): show pending markers and sync completion`
- [x] **11.3** On reconnect, sync non-open docs: pending docs plus `/api/sync/changed` results, concurrency 4, with "Syncing X of Y" progress (E2, EC5).
  - Done when: a doc edited offline but closed still uploads after reconnect.
  - Commit: `feat(web): sync closed documents on reconnect`
- [ ] **11.4** Implement the Network Monitor: browser events, socket status, `/api/health` ping, 3 s debounce, unreachable-server detection (E1, EC2, EC3, EC6).
  - Done when: stopping the server shows "Can't reach SyncScribe — working offline"; flaky toggling does not flicker.
  - Commit: `feat(web): add network monitor with debounced status`
- [ ] **11.5** Build `SyncStatusBadge` (Online/Offline/Syncing/Synced/Sync error + pending count), `OfflineBanner`, and **Sync now** button (E5, E6, E7, EC39).
  - Done when: all five states can be produced and look correct.
  - Commit: `feat(web): add sync status badge and offline banner`
- [ ] **11.6** Handle provider auth failures: `token-expired` → re-auth modal; `unknown-doc` → retry after `ws:` sync (FP-10.2).
  - Done when: both cases behave as specified.
  - Commit: `feat(web): handle sync authentication failures`
- [ ] **11.7** Verify cross-tab sync via provider broadcast, including offline (EC28, DF16).
  - Done when: two tabs offline mirror each other's typing.
  - Commit: `test(web): verify cross-tab sync works offline`
- [ ] **11.8** New-device bootstrap: on sign-in, fetch `/api/sync/all`, download all docs, record `{uid}:offlineSet` and show the offline-available icon (A6, D6, DF13).
  - Done when: signing in on a second browser shows all docs, and they open offline.
  - Commit: `feat(web): download all documents on a new device`

## Step 12 — Real-time collaboration and presence · FP-10.4, BP-6.6

- [ ] **12.1** Pass awareness to `yCollab` so remote cursors and selections show with name and colour (F1, F3).
  - Done when: two users see each other's cursor and typing within about a second.
  - Commit: `feat(web): show live cursors and selections`
- [ ] **12.2** Build `PresenceAvatars` from awareness, with an offline indicator for the local user (F2, 4.6).
  - Done when: avatars appear and disappear as users open and close the doc.
  - Commit: `feat(web): add presence avatars`
- [ ] **12.3** Manually verify the PRD 4.5 scenario (two users offline, then reconnect) and record the result in `docs/TEST_NOTES.md`.
  - Done when: both users see identical content and nothing is lost.
  - Commit: `test: verify offline concurrent edits merge without loss`

## Step 13 — Permissions, sharing and workspaces · BP-4.2, BP-5.2, BP-5.3, BP-6.2, FP-12, FP-13

- [ ] **13.1** Implement full `roleFor` (owner, workspace role, doc share, ancestor folder share) with unit tests (BP-4.2).
  - Done when: tests cover every rule.
  - Commit: `feat(server): resolve roles from workspaces and shares`
- [ ] **13.2** Enforce read-only connections for viewers/commenters on `doc:`, viewers on `cm:` (G5, EC18).
  - Done when: a test viewer's update is discarded by the server.
  - Commit: `feat(server): enforce read-only sync for viewers and commenters`
- [ ] **13.3** Add shares endpoints (list, invite, change role, remove) with the editor-up-to-editor rule, pending email invites attached at sign-up, and socket closing on change (G1, G2, G4, EC16, EC17, EC22).
  - Done when: supertest and a provider test cover invite, downgrade and removal.
  - Commit: `feat(server): add document and folder sharing`
- [ ] **13.4** Add share-link endpoints: create, revoke, accept; revoked → 410 "This link is no longer active" (G3, EC23).
  - Done when: tests cover a valid and a revoked link.
  - Commit: `feat(server): add share links`
- [ ] **13.5** Add workspaces and members endpoints (B2) and `GET /api/shared-with-me`.
  - Done when: a team workspace can be created and a member invited.
  - Commit: `feat(server): add team workspaces and shared-with-me listing`
- [ ] **13.6** Add the client outbox (enqueue, persist, ordered flush with retry, 4xx drop with toast) (FP-13).
  - Done when: an invite made offline is sent automatically after reconnecting.
  - Commit: `feat(web): add offline outbox for server actions`
- [ ] **13.7** Build `ShareDialog`: invite with role, link create/copy/revoke, manage access list; controls hidden by capability (G1–G4).
  - Done when: an owner shares a doc and the invitee sees it.
  - Commit: `feat(web): add share dialog`
- [ ] **13.8** Make the editor read-only with `ReadOnlyBanner` by role; handle `forbidden` with `RevokedBanner`, export of the local copy, removal from the sidebar; reconnect on `role-changed` (G5, EC16, EC17).
  - Done when: downgrading and removing access behave as specified, including while offline.
  - Commit: `feat(web): enforce roles and handle revoked access`
- [ ] **13.9** Build `/shared` (cached offline), `/s/:token` accept page, workspace switcher and members page (G1, G3, B2, EC22).
  - Done when: all three screens work.
  - Commit: `feat(web): add shared-with-me, share link and workspace screens`
- [ ] **13.10** Build the `SignOutDialog` with unsynced-docs warning and "Sign out and clear this device" (A2, EC20, EC21).
  - Done when: signing out with pending changes shows the warning; clearing removes all local data for that user.
  - Commit: `feat(web): add safe sign-out with local data options`

## Step 14 — Trash and structural edge cases · FP-8.2, FP-8.3, BP-5.4, BP-9

- [ ] **14.1** Implement trash/restore in `tree.ts` (descendants together, restore to original or root) and the `/trash` screen (B10, 4.10).
  - Done when: deleting and restoring a folder with children works offline.
  - Commit: `feat(web): add trash and restore`
- [ ] **14.2** Add permanent delete (owner only, confirm, outbox if offline) and `DELETE /api/docs/:id` on the server.
  - Done when: a permanently deleted doc's data is removed from the database.
  - Commit: `feat: add permanent delete for owners`
- [ ] **14.3** Add the daily Trash purge job (30 days) and automatic version pruning (BP-9).
  - Done when: a test with a faked old `deletedAt` purges the item.
  - Commit: `feat(server): add scheduled trash purge`
- [ ] **14.4** Add `DocDeletedBanner` for docs deleted remotely while open (EC9) and auto-move to root when editing inside a deleted folder (EC13).
  - Done when: both scenarios behave as specified with two users.
  - Commit: `feat(web): handle edits to deleted documents and folders`
- [ ] **14.5** Add the cycle-fix writer and notice for conflicting folder moves (EC12).
  - Done when: two users creating a cycle offline end with the same tree and see a notice.
  - Commit: `feat(web): resolve conflicting folder moves`

## Step 15 — Search · FP-14

- [ ] **15.1** Build the MiniSearch service: index on startup in batches, update on changes (debounced) (I1).
  - Done when: a unit test finds a doc by a word in its content.
  - Commit: `feat(web): add offline full-text search index`
- [ ] **15.2** Build the search overlay with highlighted snippets and jump-to-match, and quick open (Cmd+P) (I1, I2, 4.11).
  - Done when: searching offline finds and opens the right doc at the match.
  - Commit: `feat(web): add search overlay and quick open`

## Step 16 — Version history · BP-5.5, BP-6.3, FP-15.3

- [ ] **16.1** Add the snapshot policy in `onStoreDocument` (10-minute interval, authors set, retention) (H1).
  - Done when: editing over time creates versions with authors.
  - Commit: `feat(server): add automatic version snapshots`
- [ ] **16.2** Add versions endpoints: list, get state, create named, rename (H1, H4).
  - Done when: supertest covers all four.
  - Commit: `feat(server): add version history endpoints`
- [ ] **16.3** Build the history panel: list, read-only preview, restore as a new change, name a version (H1, H3, H4, DF12).
  - Done when: restoring a version updates collaborators and keeps the current version recoverable.
  - Commit: `feat(web): add version history panel with restore`

## Step 17 — Import, export, notifications, storage safety · FP-15, BP-5.6

- [ ] **17.1** Add import of `.md`/`.txt` files with per-file error messages (J1, EC35).
  - Done when: importing a mix of valid and invalid files imports the valid ones and names the failed ones.
  - Commit: `feat(web): add markdown and text import`
- [ ] **17.2** Add export: Markdown, HTML, PDF (print view) and workspace zip (J2, EC38).
  - Done when: all four exports work offline.
  - Commit: `feat(web): add document and workspace export`
- [ ] **17.3** Add notifications on the server (create, list, mark read, live stateless delivery) and `POST /api/mentions` (J3, F5).
  - Done when: sharing a doc creates a live notification for the invitee.
  - Commit: `feat(server): add notifications and live delivery`
- [ ] **17.4** Build `NotificationBell` and the list; local toasts for sync finished/failed (J3).
  - Done when: unread count and mark-as-read work.
  - Commit: `feat(web): add notification bell`
- [ ] **17.5** Add storage safety: `persist()`, usage in Settings, 80 % warning, quota-exceeded handling, private-mode warning, IndexedDB-unavailable fallback (D7, EC24–EC27, EC40).
  - Done when: each warning can be triggered (simulated) and shows the right message.
  - Commit: `feat(web): add storage usage and safety warnings`
- [ ] **17.6** Add images: paste/drop/upload to the doc `assets` map with type/size checks, rendered in preview (C10, EC34).
  - Done when: an image added offline appears for a collaborator after sync.
  - Commit: `feat(web): add offline image support`
- [ ] **17.7** Add the formatting toolbar and keyboard shortcuts, find & replace, large-paste limit (C4, C5, C11, EC32).
  - Done when: every toolbar button and shortcut in FP-9.2 works.
  - Commit: `feat(web): add formatting toolbar, shortcuts and find and replace`

## Step 18 — Testing · FP-18, BP-12

- [ ] **18.1** Unit tests for merge scenarios with two in-memory Y.Docs: EC7, EC8, EC10, EC11, H3 restore.
  - Done when: `npm test` passes.
  - Commit: `test(web): add CRDT merge scenario tests`
- [ ] **18.2** Backend sync tests: two-provider merge, viewer update discarded, revoke closes connection, snapshot created.
  - Done when: `npm test -w apps/server` passes.
  - Commit: `test(server): add sync and permission tests`
- [ ] **18.3** Set up Playwright and write E2E 1–4 from FP-18 (offline reload, close-and-reopen, two-user offline merge, auto reconnect).
  - Done when: `npm run e2e` passes locally.
  - Commit: `test(e2e): add offline and merge end-to-end tests`
- [ ] **18.4** Write E2E 5–8 (viewer read-only, revoked while offline, two tabs offline, offline search).
  - Done when: all E2E tests pass.
  - Commit: `test(e2e): add permission, multi-tab and search tests`
- [ ] **18.5** Add a GitHub Actions workflow running lint, unit and E2E tests.
  - Done when: the workflow passes on push.
  - Commit: `ci: run lint and tests on push`

## Step 19 — Polish, docs and demo

- [ ] **19.1** Add the onboarding tour (3 steps) shown on first sign-in (J4).
  - Done when: it shows once per user.
  - Commit: `feat(web): add first-run onboarding tour`
- [ ] **19.2** Accessibility and responsive pass: focus states, labels, keyboard navigation of the tree, narrow-screen layout.
  - Done when: all main flows work with keyboard only.
  - Commit: `fix(web): improve accessibility and responsive layout`
- [ ] **19.3** Write `README.md`: what it is, features, architecture diagram, setup, scripts, how to demo offline sync.
  - Done when: a fresh clone can be run by following the README.
  - Commit: `docs: add README with setup and demo guide`
  - Note: a first version was written early (after Step 10, on request). Update its features, roadmap and demo section here, then check this substep.
- [ ] **19.4** Write `docs/DEMO_SCRIPT.md`: 5-minute demo (offline edit, two-user merge, status changes, sharing, history).
  - Done when: rehearsed once end to end.
  - Commit: `docs: add demo script`
- [ ] **19.5** Optional: deploy frontend (Netlify/Vercel) and backend (Render free) and add URLs to the README.
  - Done when: the deployed app works with two browsers.
  - Commit: `chore: add deployment configuration`

## Step 20 — Could features · FP-4.4, FP-4.5, FP-9.4, FP-10.5, FP-15.3, BP-5.6

In scope. Start after Step 19 is complete, per the critical rule.

- [ ] **20.1** Comments: `cm:` doc threads anchored with relative positions; reply, resolve, reopen; commenters can write (F4).
  - Done when: a commenter adds a comment offline, it stays anchored while others edit, and it syncs.
  - Commit: `feat(web): add comments on selected text`
- [ ] **20.2** Mentions in comments via outbox → `POST /api/mentions` (F5).
  - Done when: mentioning a collaborator creates a notification for them, including when sent offline.
  - Commit: `feat(web): add mentions in comments`
- [ ] **20.3** Tags and tag filter (B7).
  - Done when: tags can be added/removed and the sidebar filters by tag.
  - Commit: `feat(web): add document tags and filtering`
- [ ] **20.4** Pin to top (B8).
  - Done when: pinned docs show at the top and stay pinned on another device.
  - Commit: `feat(web): add pinned documents`
- [ ] **20.5** Table of contents (C13).
  - Done when: headings list updates while typing and clicking one jumps to it.
  - Commit: `feat(web): add table of contents`
- [ ] **20.6** Templates: built-ins and save-as-template (C14).
  - Done when: a doc can be created from each built-in template and from a saved template.
  - Commit: `feat(web): add document templates`
- [ ] **20.7** Focus mode and theme toggle (C15).
  - Done when: focus mode hides sidebar and toolbar; light/dark choice persists.
  - Commit: `feat(web): add focus mode and theme switching`
- [ ] **20.8** Change attribution in version view (H2).
  - Done when: viewing a version highlights text added in it by each author.
  - Commit: `feat(web): highlight authors in version history`
- [ ] **20.9** Flush pending updates on tab hide (E8).
  - Done when: typing then immediately switching tabs while online leaves no pending changes.
  - Commit: `feat(web): flush pending changes when the tab is hidden`
