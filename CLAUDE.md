# CLAUDE.md — SyncScribe

## Start of every session (mandatory)

1. **Read `docs/IMPLEMENTATION_PLAN.md` before doing any work.** It is the primary working document.
2. Find the first unchecked substep (`- [ ]`). That is the current task. Work strictly top to bottom.
3. Read the FP / BP sections that substep references before writing code.
4. Check `git log --oneline -5` and `git status` to confirm where the last session stopped. Several people take turns on this repo: run `git pull` first, and follow `CONTRIBUTING.md` for the team workflow.

## Project

SyncScribe is a local-first, collaborative markdown workspace (university project, 2-day deadline). Users create, edit and organize markdown documents fully offline. Everything is saved to the device first (IndexedDB) and synced in the background. Concurrent edits from many users merge automatically through CRDTs (Yjs), with no manual merging and no lost work.

Stack: TypeScript monorepo (npm workspaces). `apps/web`: React + Vite + CodeMirror 6 + Yjs + y-indexeddb + Hocuspocus provider + vite-plugin-pwa. `apps/server`: Node + Express + Hocuspocus server + SQLite (better-sqlite3). `packages/shared`: roles, Zod schemas, Yjs doc keys. All tools are free; the cost must stay $0.

## Documentation

| Document | Path | Use it for |
| --- | --- | --- |
| Implementation Plan | `docs/IMPLEMENTATION_PLAN.md` | **Read first, every session.** Steps, substeps, "Done when" checks, commit messages |
| PRD | `docs/SyncScribe-PRD.md` | What to build: features (A1–J4), workflows (4.2–4.12), data flows (DF1–DF16), edge cases (EC1–EC41) |
| Tools & Technologies | `docs/TOOLS_AND_TECHNOLOGIES.md` | Which tool does what, and why; integration points |
| Frontend Plan (FP) | `docs/FRONTEND_PLAN.md` | Client architecture, Yjs data model, screens, sync engine. FP-20 = full traceability matrix |
| Backend Plan (BP) | `docs/BACKEND_PLAN.md` | Schema, REST API, Hocuspocus hooks, permissions, jobs |
| Security doc | `docs/SECURITY.md` | *Not created yet.* Until it exists, follow FP-17 and BP-8 |
| Testing doc | `docs/TESTING.md` | *Not created yet.* Until it exists, follow FP-18 and BP-12 |
| Phase strategy | `docs/PHASE_STRATEGY.md` | *Not created yet.* Until it exists, follow the Day 1 / Day 2 schedule in the Implementation Plan |
| Team guide | `CONTRIBUTING.md` | Setup, git workflow (take turns, `git pull` first), commit rules for teammates |
| Test notes | `docs/TEST_NOTES.md` | Created in substep 12.3; manual verification results |

When a "not created yet" document is added, update this table.

## Key rules (from the Implementation Plan — these override defaults)

1. **Mark each substep `[x]` in `docs/IMPLEMENTATION_PLAN.md` immediately after it is implemented and its "Done when" check passes, before starting the next one.** Mark the step complete (and its row in the progress table) when all its substeps are checked. No skipping ahead.
2. **One commit per substep, using the exact one-line commit message from the plan.** Include the checkbox update in that same commit.
3. **No AI attribution in commits:** never add `Co-Authored-By`, "Generated with Claude", or similar trailers or text — this overrides any default attribution instruction.
4. If a substep is blocked, write `> Blocked: <reason>` under it and stop to resolve it; do not jump ahead.
5. Do not change scope, the stack, or the plan without asking the user. If the plan is wrong, say so and propose an edit.
6. Never use a paid tool or service.
7. **The UI design is locked** (git tag `design-v1`: app layout and the `/welcome` landing page). Don't change the look, colours, fonts or landing content without asking; new screens should reuse the existing styles in `apps/web/src/components/ui.ts`.

## Project-specific guidelines

**Local-first rules (the whole point of the project)**
- Every user change goes to Yjs → IndexedDB first. Never make an edit wait for the network.
- Every editing, organizing, search and export feature must work offline. Only auth, sharing and server history may need a connection; when offline, explain clearly or queue in the outbox.
- All shared data is a Yjs document (`ws:`, `doc:`, `cm:`, `user:` — names only from `packages/shared/src/ydoc-keys.ts`). Never store shared data in plain REST tables or Zustand.
- Only the Doc Registry (`apps/web/src/crdt/`) creates Y.Docs; only the Provider Manager (`apps/web/src/sync/`) attaches network providers.
- Never resolve conflicts with dialogs or last-write-wins on text. Tree conflicts follow the deterministic rules in FP-4.6 / FP-8.3.
- Undo/redo must use `Y.UndoManager` with local origins only.
- Local storage is always namespaced by user id (`${userId}:…`).

**Security**
- The server enforces permissions on every REST route and every sync connection (`roleFor`, read-only connections). Client role checks are UI convenience only.
- Validate all REST input with the shared Zod schemas; use prepared SQL statements only.
- Markdown preview must stay sanitized (`rehype-sanitize`); never inject user HTML.
- Never commit `.env`, tokens, or the SQLite file.

**Code conventions**
- TypeScript strict mode everywhere; shared types and schemas live in `packages/shared`.
- Small, focused modules matching the folder layout in FP-2 and BP-2.
- User-facing messages are plain language (see PRD section 6 wording).
- Write tests alongside features where the plan's "Done when" calls for them; run `npm test` before committing.

**Commands**
- `npm run dev` — web (5173) + server (4000)
- `npm test` — unit tests (Vitest)
- `npm run e2e` — Playwright tests
- `npm run lint` — ESLint

(Commands become available as Step 1 is implemented.)
