import { get, set } from "idb-keyval";
import { nanoid } from "nanoid";
import { useSession } from "../stores/session";
import { useNetwork } from "../stores/network";
import { toast } from "../stores/ui";
import { ApiError, api } from "./api";

// Server actions made while offline (invites, mentions, permanent deletes, version names), kept across
// reloads and sent in order once SyncScribe is reachable (FP-13)

export interface OutboxItem {
  id: string;
  label: string; // what the user did, for the failure message: "Invite to x@y"
  method: string;
  path: string;
  body?: unknown;
  createdAt: number;
}

let items: OutboxItem[] = [];
const key = () => `${useSession.getState().user?.id ?? "anon"}:outbox`;
const save = () => set(key(), items);

export const outboxItems = () => items;

export async function loadOutbox() {
  items = (await get<OutboxItem[]>(key())) ?? [];
  flush();
}

/** Calls the server now, or queues the call while offline. Resolves to null when it was queued. */
export async function sendOrQueue<T>(label: string, method: string, path: string, body?: unknown): Promise<T | null> {
  if (useNetwork.getState().serverReachable && !items.length) {
    try {
      return await api<T>(path, { method, body });
    } catch (e) {
      if (!(e instanceof ApiError) || e.status !== 0) throw e; // a real answer from the server
    }
  }
  items = [...items, { id: nanoid(), label, method, path, body, createdAt: Date.now() }];
  await save();
  flush();
  return null;
}

let flushing = false;
let delay = 1000;
let retry: ReturnType<typeof setTimeout> | undefined;

/** Sends queued calls oldest first; stops at a network or server error and retries with backoff. */
export async function flush() {
  if (flushing || !items.length || !useNetwork.getState().serverReachable) return;
  flushing = true;
  clearTimeout(retry);
  try {
    while (items.length) {
      const item = items[0];
      try {
        await api(item.path, { method: item.method, body: item.body });
      } catch (e) {
        const status = e instanceof ApiError ? e.status : 0;
        if (status < 400 || status >= 500 || status === 401) {
          retry = setTimeout(flush, delay); // offline, server trouble or signed out: keep it for later
          delay = Math.min(delay * 2, 60_000);
          return;
        }
        toast(`${item.label} failed: ${(e as Error).message}`, "error"); // the server said no: drop it
      }
      items = items.slice(1);
      await save();
      delay = 1000;
    }
  } finally {
    flushing = false;
  }
}

useNetwork.subscribe((s, prev) => {
  if (s.serverReachable && !prev.serverReachable) flush();
});
