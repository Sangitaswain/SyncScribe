import { create } from "zustand";

export interface Toast {
  id: number;
  message: string;
  kind: "info" | "success" | "error";
}

interface UiState {
  sidebarOpen: boolean;
  focusMode: boolean;
  modal: string | null;
  toasts: Toast[];
}

export const isDesktop = () => typeof window !== "undefined" && window.matchMedia?.("(min-width: 768px)").matches;

/** Sidebar starts open on desktop and closed on phones. */
export const useUi = create<UiState>(() => ({ sidebarOpen: !!isDesktop(), focusMode: false, modal: null, toasts: [] }));

let nextId = 1;
export const toast = (message: string, kind: Toast["kind"] = "info") => {
  const id = nextId++;
  useUi.setState((s) => ({ toasts: [...s.toasts, { id, message, kind }] }));
  setTimeout(() => useUi.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4000);
};
