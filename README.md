# SyncScribe

**A local-first, collaborative markdown workspace.** Write and organize notes with no internet connection. Everything saves to your device first and syncs in the background when you're back online. If several people edit the same document at once, their changes merge automatically: no conflict dialogs, no lost work.

> University project, built in two days. Developed in phases, following [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md).

---

## Features

**Working now**

- **Works offline.** Documents live in IndexedDB, so you can open, edit, create and organize them without a network. After the first visit, a service worker (PWA) loads the app shell offline.
- **Markdown editor.** Built on CodeMirror 6, with edit, side-by-side and preview modes, word count and reading time. The preview is sanitized and highlights code.
- **Organization.** Nested folders, drag and drop, rename, move, duplicate, delete, sort, and a list of recent documents.
- **Accounts.** Sign up, log in and reset your password. Your session stays valid offline. When the token expires, the app asks you to sign in again and keeps your local work.
- **Sync server.** Hocuspocus (Yjs) stores every document in SQLite. Every connection is authenticated and checked against your permissions, and viewers get read-only connections.
- **Landing page** at `/welcome`.

**In progress** (see the [roadmap](#roadmap))

Live sync in the browser with an online/offline indicator, real-time cursors and presence, sharing and roles, trash, full-text search, version history, import and export.

---

## How it works

```
 Browser (apps/web)                                Server (apps/server)
┌──────────────────────────────────┐            ┌──────────────────────────────┐
│ React UI · CodeMirror editor     │            │ Express REST API             │
│        │                         │   HTTPS    │  /api/auth  /api/me          │
│        ▼                         │◄──────────►│  /api/sync  /api/health      │
│ Yjs documents (CRDT)             │            │                              │
│        │                         │  WebSocket │ Hocuspocus sync server       │
│        ├──► IndexedDB (saved     │◄──────────►│  /collab  (auth + roles)     │
│        │    first, works offline)│            │        │                     │
│        └──► Sync provider        │            │        ▼                     │
│ Service worker (offline shell)   │            │ SQLite (better-sqlite3)      │
└──────────────────────────────────┘            └──────────────────────────────┘
```

1. Every edit goes to a **Yjs document** in memory and is saved straight away to **IndexedDB**. Edits never wait for the network.
2. When the device is online, the sync provider exchanges Yjs updates with the **Hocuspocus** server, which saves them to **SQLite**.
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

| Part              | Tools                                                                        |
| ----------------- | ---------------------------------------------------------------------------- |
| Frontend          | React 19, Vite, TypeScript, Tailwind CSS 4, React Router, Zustand            |
| Editor            | CodeMirror 6, y-codemirror.next, react-markdown, remark-gfm, rehype-sanitize |
| Local-first       | Yjs, y-indexeddb, vite-plugin-pwa (Workbox)                                  |
| Backend           | Node.js, Express 5, Hocuspocus 4, SQLite (better-sqlite3)                    |
| Auth and security | bcryptjs, JWT (jose), helmet, rate limiting, Zod validation                  |
| Testing           | Vitest, Testing Library, supertest, fake-indexeddb                           |

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
# SMTP_URL=smtp://user:pass@host:587   # without it, reset emails print to the server console
```

---

## Scripts

| Command         | What it does                                             |
| --------------- | -------------------------------------------------------- |
| `npm run dev`   | Starts the web app (5173) and the server (4000) together |
| `npm test`      | Runs all unit and integration tests                      |
| `npm run lint`  | Runs ESLint                                              |
| `npm run build` | Builds every package for production                      |

---

## Try the offline mode

1. Run `npm run dev`, open <http://localhost:5173> and create an account.
2. Open DevTools → **Network** and choose **Offline**.
3. Create folders and documents, edit them, then reload the page. Everything is still there, because it was saved to IndexedDB.
4. Switch back to **Online**.

When Step 11 is finished, the changes you made offline will sync to the server automatically, and a second browser window will receive them.

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

---

## Roadmap

| #    | Step                                                                                              | Status  |
| ---- | ------------------------------------------------------------------------------------------------- | ------- |
| 1–10 | Setup, shared package, backend, auth, app shell, offline data layer, sidebar, editor, sync server | ✅ Done |
| 11   | Frontend sync engine and network status                                                           | ⏳ Next |
| 12   | Real-time collaboration and presence                                                              | ⬜      |
| 13   | Permissions, sharing and workspaces                                                               | ⬜      |
| 14   | Trash and structural edge cases                                                                   | ⬜      |
| 15   | Search                                                                                            | ⬜      |
| 16   | Version history                                                                                   | ⬜      |
| 17   | Import, export, notifications, storage safety                                                     | ⬜      |
| 18   | Testing                                                                                           | ⬜      |
| 19   | Polish, docs and demo                                                                             | ⬜      |
| 20   | Extras: comments, mentions, tags, pins, table of contents, templates, focus mode                  | ⬜      |
