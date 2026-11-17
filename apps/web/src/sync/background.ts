import { get, set } from "idb-keyval";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import { api } from "../services/api";
import { pendingNames } from "../services/pending";
import { useSession } from "../stores/session";
import { useNetwork } from "../stores/network";
import { attach, detach, isAttached, isOpen, onConnect, workspacesSynced } from "./providers";

// Background sync of closed docs (E2, EC5): on every (re)connect, upload docs edited offline and
// download docs changed on the server, a few at a time, then disconnect them again.

const CONCURRENCY = 4;
const TIMEOUT = 15_000;
const key = () => `${useSession.getState().user?.id}:lastSyncedAt`;

const timeout = (ms: number) => new Promise<boolean>((r) => setTimeout(() => r(false), ms));

/** Resolves true when the server has everything; false if the doc was refused or it took too long. */
const settled = (p: HocuspocusProvider) =>
  new Promise<boolean>((resolve) => {
    const timer = setTimeout(finish, TIMEOUT);
    function check() {
      if (p.isSynced && p.unsyncedChanges === 0) finish(true);
    }
    function finish(ok = false) {
      clearTimeout(timer);
      p.off("synced", check);
      p.off("unsyncedChanges", check);
      p.off("authenticationFailed", refused);
      resolve(ok);
    }
    const refused = () => finish();
    p.on("synced", check);
    p.on("unsyncedChanges", check);
    p.on("authenticationFailed", refused);
    check();
  });

async function syncOne(name: string) {
  const ok = await settled(await attach(name));
  if (!isOpen(name)) await detach(name); // keep it if the user opened it meanwhile
  return ok;
}

let running = false;

export async function syncClosedDocs() {
  if (running || useSession.getState().status !== "signedIn") return;
  running = true;
  try {
    // Workspace trees first, so the server knows about docs created offline
    await Promise.race([workspacesSynced().then(() => true), timeout(TIMEOUT)]);
    // A device that never synced downloads everything it can access (A6, DF13)
    const since = await get<number>(key());
    const changed = await api<{ names: string[]; now: number }>(since ? `/sync/changed?since=${since}` : "/sync/all").catch(
      () => null,
    );
    const queue = [...new Set([...pendingNames(), ...(changed?.names ?? [])])].filter(
      (n) => (n.startsWith("doc:") || n.startsWith("cm:")) && !isAttached(n),
    );
    const total = queue.length;
    let done = 0;
    let allOk = true;
    const progress = () => useNetwork.setState({ progress: total ? { done, total } : null });
    progress();
    await Promise.all(
      Array.from({ length: CONCURRENCY }, async () => {
        for (let name = queue.shift(); name; name = queue.shift()) {
          if (!(await syncOne(name))) allOk = false;
          done++;
          progress();
        }
      }),
    );
    // Only move the "since" mark forward if every download finished, so nothing is skipped next time
    if (changed && allOk) {
      await set(key(), changed.now);
      useNetwork.setState({ lastSyncedAt: changed.now });
    }
  } finally {
    useNetwork.setState({ progress: null });
    running = false;
  }
}

onConnect(syncClosedDocs);
