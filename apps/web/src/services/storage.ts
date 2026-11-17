import { create } from "zustand";
import { setSaveOnDevice } from "../crdt/registry";

// Device storage: usage, persistence and the warnings that go with it (D7, EC24, EC25, EC27, EC40)

export type StorageWarning = "unavailable" | "full" | "nearlyFull" | "private";

export const useStorage = create<{ usage: number | null; quota: number | null; warning: StorageWarning | null }>(() => ({
  usage: null,
  quota: null,
  warning: null,
}));

const MB = 1024 * 1024;

/** True if IndexedDB can be opened (it can be blocked by browser settings). */
export function probeIndexedDB() {
  return new Promise<boolean>((resolve) => {
    try {
      const req = indexedDB.open("syncscribe-check");
      req.onsuccess = () => {
        req.result.close();
        resolve(true);
      };
      req.onerror = req.onblocked = () => resolve(false);
    } catch {
      resolve(false); // indexedDB missing or access denied
    }
  });
}

/** Re-reads how much space SyncScribe uses; warns above 80 % of what the browser allows. */
export async function refreshUsage() {
  const est = await navigator.storage?.estimate?.().catch(() => undefined);
  if (!est?.quota) return;
  useStorage.setState({ usage: est.usage ?? 0, quota: est.quota });
  if ((est.usage ?? 0) / est.quota > 0.8 && !useStorage.getState().warning) useStorage.setState({ warning: "nearlyFull" });
}

/** At start-up: check storage works, ask the browser to keep our data, and look for private browsing. */
export async function startStorage() {
  if (!(await probeIndexedDB())) {
    setSaveOnDevice(false);
    return useStorage.setState({ warning: "unavailable" });
  }
  const persisted = await navigator.storage?.persist?.().catch(() => false);
  await refreshUsage();
  const { quota } = useStorage.getState();
  // Private windows get a small quota and refuse persistence (heuristic)
  if (quota !== null && (quota < 120 * MB || persisted === false) && !useStorage.getState().warning)
    useStorage.setState({ warning: "private" });
}

/** A write failed because the device is full (EC25). */
export const reportStorageFull = () => useStorage.setState({ warning: "full" });

// Writes to IndexedDB happen in the background; a full disk shows up as an unhandled QuotaExceededError
if (typeof window !== "undefined")
  window.addEventListener("unhandledrejection", (e) => {
    if ((e.reason as Error | undefined)?.name === "QuotaExceededError") reportStorageFull();
  });

export const formatSize = (bytes: number) =>
  bytes >= 1024 * MB ? `${(bytes / (1024 * MB)).toFixed(1)} GB` : `${Math.max(1, Math.round(bytes / MB))} MB`;

export const WARNINGS: Record<StorageWarning, string> = {
  unavailable:
    "Offline mode isn't available in this browser setting. SyncScribe works online only, and your changes are saved to the server.",
  full: "Your device storage is full. New images can't be added. Your typing is kept for now: free up space or reconnect so it can sync.",
  nearlyFull:
    "Your device storage is nearly full. Remove offline copies of shared documents you rarely use, or large images, to make room.",
  private: "This looks like a private window. Anything saved only on this device is lost when you close it, so stay online to sync.",
};
