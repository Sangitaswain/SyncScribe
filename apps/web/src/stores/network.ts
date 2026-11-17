import { create } from "zustand";

export type SyncState = "online" | "offline" | "syncing" | "synced" | "error";

interface NetworkState {
  browserOnline: boolean;
  serverReachable: boolean;
  syncState: SyncState;
  pendingCount: number;
  lastSyncedAt: number | null;
  errorReason: string | null;
  progress: { done: number; total: number } | null;
}

export const useNetwork = create<NetworkState>(() => ({
  browserOnline: navigator.onLine,
  // Assume reachable while the browser is online; the Network Monitor confirms within 3 s (EC2)
  serverReachable: navigator.onLine,
  syncState: navigator.onLine ? "online" : "offline",
  pendingCount: 0,
  lastSyncedAt: null,
  errorReason: null,
  progress: null,
}));
