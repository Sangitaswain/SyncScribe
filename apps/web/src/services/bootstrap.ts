import * as Y from "yjs";
import { getDoc, releaseDoc } from "../crdt/registry";
import { remoteOrigins } from "../sync/origins";
import { useSession } from "../stores/session";
import { api } from "./api";

/** Origin for changes downloaded from the server, so they are not counted as local edits. */
const bootstrapOrigin = {};
remoteOrigins.add(bootstrapOrigin);

const fromBase64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/**
 * Downloads the user's workspaces and documents into IndexedDB (e.g. the Welcome doc after sign-up,
 * or everything on a new device). Merging is safe to repeat: Yjs ignores updates it already has.
 */
export async function bootstrap() {
  if (useSession.getState().status !== "signedIn" || !navigator.onLine) return;
  try {
    const { docs } = await api<{ docs: Record<string, string> }>("/sync/bootstrap");
    for (const [name, state] of Object.entries(docs)) {
      const doc = await getDoc(name);
      Y.applyUpdate(doc, fromBase64(state), bootstrapOrigin);
      releaseDoc(name);
    }
  } catch {
    // offline or server down: local data still works; try again next time
  }
}
