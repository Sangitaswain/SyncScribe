import { create } from "zustand";
import type { User, Workspace } from "@syncscribe/shared";

interface SessionState {
  user: User | null;
  token: string | null;
  status: "loading" | "signedOut" | "signedIn" | "needsReauth";
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
}

export const useSession = create<SessionState>(() => ({
  user: null,
  token: null,
  status: "loading",
  workspaces: [],
  activeWorkspaceId: null,
}));
