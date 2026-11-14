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

export const useUi = create<UiState>(() => ({ sidebarOpen: false, focusMode: false, modal: null, toasts: [] }));

let nextId = 1;
export const toast = (message: string, kind: Toast["kind"] = "info") => {
  const id = nextId++;
  useUi.setState((s) => ({ toasts: [...s.toasts, { id, message, kind }] }));
  setTimeout(() => useUi.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4000);
};
