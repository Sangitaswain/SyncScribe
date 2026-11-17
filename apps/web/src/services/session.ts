import { del, delMany, get, keys, set } from "idb-keyval";
import type { AuthResponse } from "@syncscribe/shared";
import { useSession } from "../stores/session";
import { api } from "./api";

// Cached in IndexedDB so the app can start signed in with no network (A3, FP-4.7)
const KEY = "session";

export async function saveSession(auth: AuthResponse) {
  const { user, token, workspaces } = auth;
  await set(KEY, auth);
  useSession.setState((s) => ({
    user,
    token,
    workspaces,
    status: "signedIn",
    activeWorkspaceId: workspaces.some((w) => w.id === s.activeWorkspaceId) ? s.activeWorkspaceId : user.personalWorkspaceId,
  }));
}

export async function loadSession() {
  const auth = await get<AuthResponse>(KEY);
  if (auth) await saveSession(auth);
  else useSession.setState({ status: "signedOut" });
}

export async function clearSession() {
  await del(KEY);
  useSession.setState({ user: null, token: null, workspaces: [], activeWorkspaceId: null, status: "signedOut" });
}

const deleteDatabase = (name: string) =>
  new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });

/**
 * Deletes everything this user saved on the device (their docs and local lists), then signs out (EC20, EC21).
 * Open docs must be closed first (stopSync), or the databases can't be deleted.
 */
export async function clearDevice() {
  const uid = useSession.getState().user?.id;
  if (!uid) return;
  const mine = (name?: string | IDBValidKey) => String(name).startsWith(`${uid}:`);
  const dbs = await indexedDB.databases();
  await Promise.all(dbs.filter((d) => mine(d.name)).map((d) => deleteDatabase(d.name!)));
  await delMany((await keys()).filter(mine));
  await clearSession();
}

const DAY = 24 * 60 * 60 * 1000;

/** Expiry time (ms) read from the JWT payload; no verification needed on the client. */
export const tokenExpiry = (token: string) => {
  try {
    return JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).exp * 1000;
  } catch {
    return 0;
  }
};

/** On start-up and reconnect: refresh a token close to expiry; an expired one needs sign-in (EC19). */
export async function refreshIfNeeded() {
  const { token, status } = useSession.getState();
  if (!token || status !== "signedIn" || !navigator.onLine) return;
  const left = tokenExpiry(token) - Date.now();
  if (left <= 0) return useSession.setState({ status: "needsReauth" });
  if (left > DAY) return;
  try {
    await saveSession(await api<AuthResponse>("/auth/refresh", { method: "POST" }));
  } catch {
    // offline or server down: try again on the next reconnect
  }
}
