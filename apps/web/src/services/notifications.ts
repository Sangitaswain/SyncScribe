import type { AppNotification } from "@syncscribe/shared";
import { useNotifications } from "../stores/notifications";
import { useNetwork } from "../stores/network";
import { api } from "./api";
import { sendOrQueue } from "./outbox";

// Notifications from the server (J3): loaded when online, live ones arrive through the sync connection

export async function loadNotifications() {
  try {
    useNotifications.setState({ items: (await api<{ notifications: AppNotification[] }>("/notifications")).notifications });
  } catch {
    // offline: keep what we have
  }
}

/** A live notification pushed by the server; ignored if we already have it. */
export function receive(n: AppNotification) {
  useNotifications.setState((s) => (s.items.some((i) => i.id === n.id) ? s : { items: [n, ...s.items] }));
}

/** Marks notifications read here at once; the server is told now or when back online. */
export function markRead(ids: string[]) {
  if (!ids.length) return;
  const now = Date.now();
  useNotifications.setState((s) => ({ items: s.items.map((n) => (ids.includes(n.id) && !n.readAt ? { ...n, readAt: now } : n)) }));
  return sendOrQueue("Marking notifications as read", "POST", "/notifications/read", { ids }).catch(() => {});
}

useNetwork.subscribe((s, prev) => {
  if (s.serverReachable && !prev.serverReachable) loadNotifications();
});
