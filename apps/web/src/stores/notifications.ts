import { create } from "zustand";
import type { AppNotification } from "@syncscribe/shared";

export const useNotifications = create<{ items: AppNotification[] }>(() => ({ items: [] }));

export const unreadCount = (items: AppNotification[]) => items.filter((n) => !n.readAt).length;
