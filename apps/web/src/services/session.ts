import { del, get, set } from "idb-keyval";
import type { AuthResponse } from "@syncscribe/shared";
import { useSession } from "../stores/session";

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
