import { HocuspocusProvider, HocuspocusProviderWebsocket, WebSocketStatus } from "@hocuspocus/provider";
import { userDoc, wsDoc } from "@syncscribe/shared";
import { closeAll, getDoc, releaseDoc } from "../crdt/registry";
import { useSession } from "../stores/session";
import { useNetwork } from "../stores/network";
import { API_URL } from "../services/api";
import { clearPending } from "../services/pending";
import { remoteOrigins } from "./origins";

// Provider Manager (FP-10.1): the only place network providers are attached to Y.Docs.
// One WebSocket is shared by every doc; edits made offline are sent when it reconnects.

const COLLAB_URL = import.meta.env.VITE_COLLAB_URL ?? `${API_URL.replace(/^http/, "ws")}/collab`;

let socket: HocuspocusProviderWebsocket | null = null;
const providers = new Map<string, Promise<HocuspocusProvider>>();
const connectListeners = new Set<() => void>();
const disconnectListeners = new Set<() => void>();

/** Runs `fn` every time the shared socket (re)connects. */
export const onConnect = (fn: () => void) => connectListeners.add(fn);
/** Runs `fn` every time the shared socket loses its connection. */
export const onDisconnect = (fn: () => void) => disconnectListeners.add(fn);

/**
 * Retries a dropped socket now instead of waiting out its backoff (EC3). With `force` ("Sync now", E7)
 * it also drops a live connection, so every doc signs in and syncs again.
 */
export function reconnect(force = false) {
  if (!socket) return;
  // Closing the live socket makes it reopen by itself (disconnect() + connect() would leave it closed)
  if (force && socket.status === WebSocketStatus.Connected) socket.webSocket?.close();
  else if (force || socket.status === WebSocketStatus.Disconnected) socket.connect();
}

/** Resolves once the server has everything this provider holds (synced, nothing unconfirmed). */
export const whenSynced = (p: HocuspocusProvider) =>
  new Promise<void>((resolve) => {
    const check = () => {
      if (!p.isSynced || p.unsyncedChanges > 0) return;
      p.off("synced", check);
      p.off("unsyncedChanges", check);
      resolve();
    };
    p.on("synced", check);
    p.on("unsyncedChanges", check);
    check();
  });

// Refused sync connections (FP-10.2): a doc is retried after the workspace trees reach the server
// (the server doesn't know a doc until the tree listing it arrives); refused 3 times → Sync error (EC39)
const SESSION_REASONS = ["token-expired", "invalid-token"];
const RETRIES = 3;

function onRefused(name: string, provider: HocuspocusProvider, reason: string, attempt: number) {
  if (SESSION_REASONS.includes(reason)) {
    // Keep working on this device; sign in again, then everything reconnects (EC19)
    if (useSession.getState().status === "signedIn") useSession.setState({ status: "needsReauth" });
    return;
  }
  if (attempt + 1 >= RETRIES)
    return useNetwork.setState({ errorReason: "The server refused to sync. Your changes are safe on this device." });
  workspacesSynced()
    .then(() => new Promise((r) => setTimeout(r, 1000 * (attempt + 1))))
    .then(async () => {
      if ((await providers.get(name)) !== provider) return; // detached meanwhile
      await provider.sendToken(); // sign this doc in again on the same socket
      provider.startSync();
    });
}

/** Starts syncing a doc (no-op if it is already attached). */
export function attach(name: string): Promise<HocuspocusProvider> {
  const existing = providers.get(name);
  if (existing) return existing;
  if (!socket) {
    socket = new HocuspocusProviderWebsocket({ url: COLLAB_URL });
    socket.on("connect", () => connectListeners.forEach((fn) => fn()));
    socket.on("disconnect", () => disconnectListeners.forEach((fn) => fn()));
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
    let attempt = 0;
    provider.on("authenticationFailed", ({ reason }: { reason: string }) => onRefused(name, provider, reason, attempt++));
    provider.on("authenticated", () => (attempt = 0));
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
