# SyncScribe

**A local-first, collaborative markdown workspace.** Write and organize notes with no internet connection. Everything saves to your device first and syncs in the background when you're back online. If several people edit the same document at once, their changes merge automatically: no conflict dialogs, no lost work.

> University project, built in two days. Developed in phases, following [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md).

[![CI](https://github.com/Sangitaswain/SyncScribe/actions/workflows/ci.yml/badge.svg)](https://github.com/Sangitaswain/SyncScribe/actions/workflows/ci.yml)

---

## Features

- **Works offline.** Documents live in IndexedDB, so you can open, edit, create, organize, search and export them without a network. After the first visit, a service worker (PWA) loads the app offline too.
- **Syncs by itself.** Changes sync in the background when you're online. A status badge shows Online, Offline, Syncing, Synced or Sync error, with the number of unsynced changes and a **Sync now** button. Two tabs on one device stay in step, even offline.
- **Real-time collaboration.** See other people's cursors, selections and avatars. Edits from any number of people merge automatically (Yjs CRDT): no conflict dialogs, no lost work, even after editing offline.
- **Markdown editor.** CodeMirror 6 with a formatting toolbar, keyboard shortcuts, find and replace, images (paste, drop or upload, stored with the document), undo that only undoes your own changes, and edit / side-by-side / preview modes. The preview is sanitized.
- **Organization.** Nested folders, drag and drop, rename, move, duplicate, sort, recent documents, and a Trash you can restore from (emptied after 30 days).
- **Sharing.** Invite people as Editor, Commenter or Viewer, share links you can revoke, team workspaces with members, and a "Shared with me" list. The server enforces every role; viewers get read-only connections.
- **Search.** Full-text search across everything on your device (Cmd/Ctrl+K) and quick open by title (Cmd/Ctrl+P), offline.
- **Version history.** Automatic versions with their authors, named versions, preview, and restore as a new change.
- **Import and export.** Import `.md` / `.txt` files. Export a document as Markdown, HTML or PDF, or a whole workspace as a zip.
- **Notifications** for shares, role changes and mentions, delivered live.
- **Storage safety.** Shows how much space SyncScribe uses and warns when storage is nearly full, in a private window, or blocked.
- **Accounts.** Sign up, sign in, password reset, profile and cursor colour. You stay signed in offline; a safe sign-out warns about unsynced changes and can clear the device.

---

## How it works

```
 Browser (apps/web)                                Server (apps/server)
┌──────────────────────────────────┐            ┌──────────────────────────────┐
│ React UI · CodeMirror editor     │            │ Express REST API             │
│        │                         │   HTTPS    │  /api/auth  /api/me          │
│        ▼                         │◄──────────►│  /api/sync  /api/shares      │
│                                  │            │  /api/workspaces /api/docs   │
│                                  │            │  /api/notifications …        │
│ Yjs documents (CRDT)             │            │                              │
│        │                         │  WebSocket │ Hocuspocus sync server       │
│        ├──► IndexedDB (saved     │◄──────────►│  /collab  (auth + roles)     │
│        │    first, works offline)│            │        │                     │
│        └──► Sync provider        │            │        ▼                     │
│ Service worker (offline shell)   │            │ SQLite (better-sqlite3)      │
└──────────────────────────────────┘            └──────────────────────────────┘
```

1. Every edit goes to a **Yjs document** in memory and is saved straight away to **IndexedDB**. Edits never wait for the network.
2. When the device is online, the sync provider exchanges Yjs updates with the **Hocuspocus** server, which checks your role for every document and saves them to **SQLite**. Actions that need the server, like inviting someone while offline, wait in an outbox and are sent when you reconnect.
3. Yjs is a **CRDT**, so concurrent edits from any number of devices always merge to the same result, even when they were made offline.

Shared data comes in four document types:

| Prefix  | Holds                                      |
| ------- | ------------------------------------------ |
| `ws:`   | The workspace tree (folders and documents) |
| `doc:`  | A document's content                       |
| `cm:`   | A document's comments                      |
| `user:` | Your preferences                           |

---

## Tech stack

| Part              | Tools                                                                          |
| ----------------- | ------------------------------------------------------------------------------ |
| Frontend          | React 19, Vite, TypeScript, Tailwind CSS 4, React Router, Zustand              |
| Editor            | CodeMirror 6, y-codemirror.next, react-markdown, remark-gfm, rehype-sanitize   |
| Local-first       | Yjs, y-indexeddb, y-protocols (presence), vite-plugin-pwa (Workbox)            |
| Search and export | MiniSearch, JSZip                                                              |
| Backend           | Node.js, Express 5, Hocuspocus 4, SQLite (better-sqlite3)                      |
| Auth and security | bcryptjs, JWT (jose), helmet, rate limiting, Zod validation                    |
| Testing           | Vitest, Testing Library, supertest, fake-indexeddb, Playwright, GitHub Actions |

Every tool is free and open source.

---

## Getting started

**You need:** Node.js 20 or newer and npm.

```bash
git clone https://github.com/Sangitaswain/SyncScribe.git
cd SyncScribe
npm install
npm run dev
```

- Web app: <http://localhost:5173>
- API and sync server: <http://localhost:4000>

The SQLite database is created automatically at `apps/server/data/syncscribe.db`.

### Configuration (optional)

The defaults are enough for local development. To change them, create `apps/server/.env`:

```env
PORT=4000
APP_URL=http://localhost:5173
JWT_SECRET=change-me-to-a-long-random-string
DB_PATH=./data/syncscribe.db
# SMTP_URL=smtp://user:pass@host:587   # without it, emails print to the server console
AUTH_RATE_LIMIT=10                     # sign-up / sign-in attempts per minute per address
```

---

## Scripts

| Command         | What it does                                                                                                                  |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`   | Starts the web app (5173) and the server (4000) together                                                                      |
| `npm test`      | Runs all unit and integration tests                                                                                           |
| `npm run e2e`   | Runs the Playwright browser tests (offline, two users, keyboard). First time: `npx playwright install chromium` in `apps/web` |
| `npm run lint`  | Runs ESLint                                                                                                                   |
| `npm run build` | Builds every package for production                                                                                           |

---

## Try the offline mode

**On one device**

1. Build and serve the app, so the service worker can cache it for offline use (`npm run dev` doesn't install it):
   `npm run dev -w apps/server` in one terminal, `npm run build -w apps/web && npm run preview -w apps/web` in another.
   Open <http://localhost:4173> and create an account.
2. Open DevTools → **Network** and choose **Offline**. Within a few seconds the badge says **Offline** and a banner explains that your work is saved on this device.
3. Create folders and documents and edit them. Each one shows a small dot while it has unsynced changes. Reload the page: everything is still there.
4. Switch back to **Online**. The badge goes to **Syncing**, then **Synced**, and the dots disappear. No clicks needed.

**Two people, both offline**

1. Open a second browser (or a private window) and create a second account.
2. In the first browser, open a document, press **Share** and invite the second account's email as an Editor. In the second browser, open **Shared with me** and the document.
3. Type in both and watch the other person's cursor and text appear live.
4. Turn both browsers **Offline**. Edit the same paragraph in both, even at the same spot.
5. Turn one back **Online**, then the other. Both end up with exactly the same text, and nothing either person typed is lost.

---

---

## Project structure

```
SyncScribe/
├── apps/
│   ├── web/          # React PWA: UI, editor, Yjs + IndexedDB layer
│   └── server/       # Express API, Hocuspocus sync server, SQLite
├── packages/
│   └── shared/       # Roles, Zod schemas, Yjs document keys (used by both apps)
└── docs/             # PRD, plans and implementation plan
```

---

## Documentation

| Document                                               | About                                                 |
| ------------------------------------------------------ | ----------------------------------------------------- |
| [PRD](docs/SyncScribe-PRD.md)                          | Product requirements: features, workflows, edge cases |
| [Tools & Technologies](docs/TOOLS_AND_TECHNOLOGIES.md) | Which tool does what, and why                         |
| [Frontend Plan](docs/FRONTEND_PLAN.md)                 | Client architecture and the Yjs data model            |
| [Backend Plan](docs/BACKEND_PLAN.md)                   | Database schema, API, sync hooks, permissions         |
| [Implementation Plan](docs/IMPLEMENTATION_PLAN.md)     | Every step and substep, with progress                 |
| [Test notes](docs/TEST_NOTES.md)                       | Results of the manual and scripted verification runs  |
| [Demo script](docs/DEMO_SCRIPT.md)                     | A 5-minute demo: offline, merge, sharing, history     |
| [Contributing](CONTRIBUTING.md)                        | How teammates set up, take turns and commit           |

---

## Roadmap

| #     | Step                                                                                              | Status  |
| ----- | ------------------------------------------------------------------------------------------------- | ------- |
| 1–10  | Setup, shared package, backend, auth, app shell, offline data layer, sidebar, editor, sync server | ✅ Done |
| 11–12 | Sync engine, network status, real-time collaboration and presence                                 | ✅ Done |
| 13–14 | Permissions, sharing, workspaces, Trash and structural edge cases                                 | ✅ Done |
| 15–17 | Search, version history, import, export, notifications, storage safety                            | ✅ Done |
| 18    | Testing: unit, integration, Playwright end-to-end, CI                                             | ✅ Done |
| 19    | Polish, docs and demo                                                                             | ⏳ Now  |
| 20    | Extras: comments, mentions, tags, pins, table of contents, templates, focus mode                  | ⬜      |
