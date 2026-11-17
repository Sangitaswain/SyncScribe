import { HocuspocusProvider, HocuspocusProviderWebsocket, WebSocketStatus } from "@hocuspocus/provider";
import { docDoc, parseDocName, userDoc, wsDoc } from "@syncscribe/shared";
import { awarenessOf, closeAll, getDoc, releaseDoc } from "../crdt/registry";
import { useSession } from "../stores/session";
import { useNetwork } from "../stores/network";
import { API_URL } from "../services/api";
import { clearPending, pendingNames } from "../services/pending";
import { offlineSet, revokedSet } from "../services/docSets";
import { setDocStatus } from "../stores/docStatus";
import { receive } from "../services/notifications";
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

/** Signs one doc in again on the same socket (after a retry wait or a role change). */
async function signInAgain(name: string, provider: HocuspocusProvider) {
  if ((await providers.get(name)) !== provider) return; // detached meanwhile
  await provider.sendToken();
  provider.startSync();
}

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
  const parsed = parseDocName(name);
  if (reason === "forbidden" && (parsed?.kind === "doc" || parsed?.kind === "cm")) {
    // Access removed: the local copy stays until the user exports or removes it (EC16)
    clearPending(name);
    return revokedSet.add(docDoc(parsed.id));
  }
  if (attempt + 1 >= RETRIES)
    return useNetwork.setState({ errorReason: "The server refused to sync. Your changes are safe on this device." });
  workspacesSynced()
    .then(() => new Promise((r) => setTimeout(r, 1000 * (attempt + 1))))
    .then(() => signInAgain(name, provider));
}

/** Read-only docs (viewer, or commenter on a doc) can't be edited; offline edits are refused (G5, EC17). */
function onAuthenticated(name: string, scope: string) {
  if (!name.startsWith("doc:")) return;
  revokedSet.remove(name); // access is back
  const readOnly = scope === "readonly";
  // The scope only says read-only or not, so "viewer" stands for any read-only role here
  setDocStatus(name, { role: readOnly ? "viewer" : "editor" });
  if (readOnly && pendingNames().includes(name)) {
    clearPending(name); // the server won't take them; the banner offers an export instead
    setDocStatus(name, { rejectedEdits: true });
  }
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
      awareness: awarenessOf(name), // the doc's own presence, so cursors show as soon as it connects
      token: () => useSession.getState().token ?? "",
    });
    remoteOrigins.add(provider); // changes from the server are not local edits
    // The server has everything once the doc is synced with no unconfirmed changes (D4, E6)
    const confirm = () => provider.isSynced && provider.unsyncedChanges === 0 && clearPending(name);
    let attempt = 0;
    provider.on("authenticationFailed", ({ reason }: { reason: string }) => onRefused(name, provider, reason, attempt++));
    provider.on("authenticated", ({ scope }: { scope: string }) => {
      attempt = 0;
      onAuthenticated(name, scope);
    });
    // Role changed on the server: it closes this doc, then we sign in again with the new role (EC17)
    provider.on("stateless", ({ payload }: { payload: string }) => {
      const message = JSON.parse(payload);
      if (message.type === "notification") return receive(message.notification); // J3, live
      if (message.type !== "role-changed") return;
      const again = () => {
        provider.off("close", again);
        setTimeout(() => signInAgain(name, provider));
      };
      provider.on("close", again);
    });
    provider.on("synced", confirm);
    if (name.startsWith("doc:")) provider.on("synced", ({ state }: { state: boolean }) => state && offlineSet.add(name));
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
