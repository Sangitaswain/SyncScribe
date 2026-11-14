import { HocuspocusProvider, HocuspocusProviderWebsocket } from "@hocuspocus/provider";
import { userDoc, wsDoc } from "@syncscribe/shared";
import { closeAll, getDoc, releaseDoc } from "../crdt/registry";
import { useSession } from "../stores/session";
import { API_URL } from "../services/api";
import { clearPending } from "../services/pending";
import { remoteOrigins } from "./origins";

// Provider Manager (FP-10.1): the only place network providers are attached to Y.Docs.
// One WebSocket is shared by every doc; edits made offline are sent when it reconnects.

const COLLAB_URL = import.meta.env.VITE_COLLAB_URL ?? `${API_URL.replace(/^http/, "ws")}/collab`;

let socket: HocuspocusProviderWebsocket | null = null;
const providers = new Map<string, Promise<HocuspocusProvider>>();
const connectListeners = new Set<() => void>();

/** Runs `fn` every time the shared socket (re)connects. */
export const onConnect = (fn: () => void) => connectListeners.add(fn);

/** Resolves once the provider has finished its first sync with the server. */
export const whenSynced = (p: HocuspocusProvider) =>
  new Promise<void>((resolve) => {
    if (p.isSynced) return resolve();
    const done = ({ state }: { state: boolean }) => state && (p.off("synced", done), resolve());
    p.on("synced", done);
  });

/** Starts syncing a doc (no-op if it is already attached). */
export function attach(name: string): Promise<HocuspocusProvider> {
  const existing = providers.get(name);
  if (existing) return existing;
  if (!socket) {
    socket = new HocuspocusProviderWebsocket({ url: COLLAB_URL });
    socket.on("connect", () => connectListeners.forEach((fn) => fn()));
  }
  const ws = socket;
  const ready = getDoc(name).then((document) => {
    const provider = new HocuspocusProvider({
      websocketProvider: ws,
      name,
      document,
      token: () => useSession.getState().token ?? "",
    });
    remoteOrigins.add(provider); // changes from the server are not local edits
    // The server has everything once the doc is synced with no unconfirmed changes (D4, E6)
    const confirm = () => provider.isSynced && provider.unsyncedChanges === 0 && clearPending(name);
    provider.on("synced", confirm);
    provider.on("unsyncedChanges", confirm);
    provider.attach();
    return provider;
  });
  providers.set(name, ready);
  return ready;
}

/** Stops syncing a doc; its data stays on the device. */
export async function detach(name: string) {
  const ready = providers.get(name);
  if (!ready) return;
  providers.delete(name);
  (await ready).destroy();
  releaseDoc(name);
}

/** Workspace trees must reach the server first, so it knows which workspace a new doc belongs to (E2). */
export const workspacesSynced = async () => {
  const { workspaces } = useSession.getState();
  await Promise.all(workspaces.map(async (w) => whenSynced(await attach(wsDoc(w.id)))));
};

const openCount = new Map<string, number>();

/** Syncs an open document (once the workspace trees are in sync) until the returned cleanup runs. */
export function syncWhileOpen(name: string) {
  openCount.set(name, (openCount.get(name) ?? 0) + 1);
  workspacesSynced().then(() => {
    if (openCount.get(name)) attach(name);
  });
  return () => {
    const left = (openCount.get(name) ?? 1) - 1;
    if (left) {
      openCount.set(name, left);
    } else {
      openCount.delete(name);
      detach(name);
    }
  };
}

/** While signed in, the user's preferences and every workspace tree are always synced. */
export function startSync() {
  const { user, workspaces } = useSession.getState();
  if (!user) return;
  attach(userDoc(user.id));
  for (const w of workspaces) attach(wsDoc(w.id));
}

/** On sign-out: disconnect everything and close the signed-out user's docs. */
export async function stopSync() {
  await Promise.all([...providers.keys()].map(detach));
  socket?.destroy();
  socket = null;
  closeAll();
}

export const providerFor = (name: string) => providers.get(name);
export const isAttached = (name: string) => providers.has(name);
export const isOpen = (name: string) => !!openCount.get(name);
