import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import { Awareness } from "y-protocols/awareness";
import { DOC, docDoc } from "@syncscribe/shared";
import { useSession } from "../stores/session";
import { markPending, pendingNames } from "../services/pending";
import { toast } from "../stores/ui";
import { fixCycles, rescueEditedDocs } from "./tree";
import { remoteOrigins } from "../sync/origins";

// The only place Y.Docs are created (FP-8.1). Every doc is persisted to IndexedDB so it opens offline.

interface Entry {
  doc: Y.Doc;
  persistence: IndexeddbPersistence;
  channel: BroadcastChannel;
  awareness?: Awareness;
  ready: Promise<Y.Doc>;
  refs: number;
}

const entries = new Map<string, Entry>();
const EDITED_EVERY = 60_000;

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
    // Other tabs on this device get local edits directly, even offline (EC28, DF16). A tab that opens
    // the doc sends what it has; the others answer with anything it is missing.
    const channel = new BroadcastChannel(dbName(name));
    channel.onmessage = ({ data }: MessageEvent<{ sv?: Uint8Array; update?: Uint8Array }>) => {
      if (data.sv) channel.postMessage({ update: Y.encodeStateAsUpdate(doc, data.sv) });
      if (data.update) Y.applyUpdate(doc, data.update, channel);
    };
    // Local edits only: not state loaded from disk, not changes received from the server
    let editedWritten = 0;
    doc.on("update", (update: Uint8Array, origin: unknown) => {
      if (origin === persistence || (origin && typeof origin === "object" && remoteOrigins.has(origin))) return;
      if (origin !== channel) channel.postMessage({ update });
      markPending(name);
      // Record "last edited" for sorting (B6), at most once a minute so it doesn't flood sync
      if (name.startsWith("doc:") && Date.now() - editedWritten > EDITED_EVERY) {
        editedWritten = Date.now();
        setTimeout(() => doc.getMap(DOC.meta).set("editedAt", editedWritten));
      }
    });
    // Tree conflicts that only appear when changes from others arrive (FP-8.3)
    if (name.startsWith("ws:"))
      doc.on("update", (_u: Uint8Array, origin: unknown) => {
        if (!(origin && typeof origin === "object" && remoteOrigins.has(origin))) return;
        setTimeout(() => {
          // EC12: folders moved into each other offline
          for (const folder of fixCycles(doc)) toast(`Folder moves conflicted; "${folder}" was moved to the top level`);
          // EC13: a folder deleted elsewhere doesn't take my unsynced edits with it
          const me = useSession.getState().user?.id;
          if (me && rescueEditedDocs(doc, (id) => pendingNames().includes(docDoc(id)), me))
            toast("Moved to top level because its folder was deleted");
        });
      });
    const ready = persistence.whenSynced.then(() => {
      channel.postMessage({ sv: Y.encodeStateVector(doc) });
      return doc;
    });
    // Who is here and where their cursor is (F2, F3); the Provider Manager relays it while online
    let awareness: Awareness | undefined;
    const user = useSession.getState().user;
    if (name.startsWith("doc:") && user) {
      awareness = new Awareness(doc);
      awareness.setLocalStateField("user", { id: user.id, name: user.name, color: user.color });
    }
    entry = { doc, persistence, channel, awareness, ready, refs: 0 };
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
  entry.awareness?.destroy();
  entry.channel.close();
  entry.persistence.destroy();
  entry.doc.destroy();
}

/** Deletes an IndexedDB database and waits until it is gone. */
export const deleteDatabase = (db: string) =>
  new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(db);
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });

/** Deletes a doc's local copy from this device, e.g. after access was removed (EC16) or a permanent delete. */
export async function deleteLocal(name: string) {
  const entry = entries.get(name);
  if (entry) {
    entries.delete(name);
    entry.awareness?.destroy();
    entry.channel.close();
    await entry.persistence.destroy(); // closes the database (y-indexeddb's clearData doesn't wait for the delete)
    entry.doc.destroy();
  }
  await deleteDatabase(dbName(name));
}

/** Presence of an open document (null for workspace and user docs). */
export const awarenessOf = (name: string) => entries.get(name)?.awareness;

/** Already-open doc, if any (used by the sync layer). */
export const peekDoc = (name: string) => entries.get(name)?.doc;

/** Closes everything, e.g. on sign-out. */
export function closeAll() {
  for (const [name, e] of entries) {
    e.awareness?.destroy();
    e.channel.close();
    e.persistence.destroy();
    e.doc.destroy();
    entries.delete(name);
  }
}
