import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import { Awareness } from "y-protocols/awareness";
import { DOC } from "@syncscribe/shared";
import { useSession } from "../stores/session";
import { markPending } from "../services/pending";
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

/** Deletes a doc's local copy from this device, e.g. after access to it was removed (EC16). */
export async function deleteLocal(name: string) {
  const entry = entries.get(name);
  if (!entry) return void indexedDB.deleteDatabase(dbName(name));
  entries.delete(name);
  entry.awareness?.destroy();
  entry.channel.close();
  await entry.persistence.clearData();
  entry.doc.destroy();
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
