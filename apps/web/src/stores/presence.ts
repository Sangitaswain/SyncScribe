import { create } from "zustand";

export interface PresenceUser {
  id: string;
  name: string;
  color: string;
}

/** People currently in the open document (from Yjs awareness). */
export const usePresence = create<{ users: PresenceUser[] }>(() => ({ users: [] }));
