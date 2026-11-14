import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import { useSession } from "../stores/session";
import { markPending } from "../services/pending";
import { remoteOrigins } from "../sync/origins";

// The only place Y.Docs are created (FP-8.1). Every doc is persisted to IndexedDB so it opens offline.

interface Entry {
  doc: Y.Doc;
  persistence: IndexeddbPersistence;
  ready: Promise<Y.Doc>;
  refs: number;
}

const entries = new Map<string, Entry>();

/** Workspace and user docs stay open for the whole session. */
const keepOpen = (name: string) => name.startsWith("ws:") || name.startsWith("user:");

/** Local IndexedDB name, namespaced by user so accounts on one device never mix (EC21). */
export const dbName = (name: string) => `${useSession.getState().user?.id ?? "anon"}:${name}`;

/** Opens (or reuses) a doc; resolves once its saved state has been loaded from the device. */
export function getDoc(name: string): Promise<Y.Doc> {
  let entry = entries.get(name);
  if (!entry) {
    const doc = new Y.Doc();
    const persistence = new IndexeddbPersistence(dbName(name), doc);
    // Local edits only: not state loaded from disk, not changes received from the server
    doc.on("update", (_u: Uint8Array, origin: unknown) => {
      if (origin !== persistence && !(origin && typeof origin === "object" && remoteOrigins.has(origin))) markPending(name);
    });
    entry = { doc, persistence, ready: persistence.whenSynced.then(() => doc), refs: 0 };
    entries.set(name, entry);
  }
  entry.refs++;
  return entry.ready;
}

/** Releases one reference; unused docs are closed (their data stays on the device). */
export function releaseDoc(name: string) {
  const entry = entries.get(name);
  if (!entry || --entry.refs > 0 || keepOpen(name)) return;
  entries.delete(name);
  entry.persistence.destroy();
  entry.doc.destroy();
}

/** Already-open doc, if any (used by the sync layer). */
export const peekDoc = (name: string) => entries.get(name)?.doc;

/** Closes everything, e.g. on sign-out. */
export function closeAll() {
  for (const [name, e] of entries) {
    e.persistence.destroy();
    e.doc.destroy();
    entries.delete(name);
  }
}
